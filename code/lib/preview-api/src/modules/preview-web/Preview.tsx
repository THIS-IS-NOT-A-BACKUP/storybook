import { dedent } from 'ts-dedent';
import { global } from '@storybook/global';
import {
  CONFIG_ERROR,
  FORCE_REMOUNT,
  FORCE_RE_RENDER,
  GLOBALS_UPDATED,
  RESET_STORY_ARGS,
  SET_GLOBALS,
  STORY_ARGS_UPDATED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from '@storybook/core-events';
import { logger } from '@storybook/client-logger';
import type { Channel } from '@storybook/channels';
import type {
  Renderer,
  Args,
  Globals,
  ModuleImportFn,
  RenderContextCallbacks,
  RenderToCanvas,
  PreparedStory,
  StoryIndex,
  ProjectAnnotations,
  StoryId,
  StoryRenderOptions,
  SetGlobalsPayload,
} from '@storybook/types';
import { addons } from '../addons';
import { StoryStore } from '../../store';

import { StoryRender } from './render/StoryRender';
import type { CsfDocsRender } from './render/CsfDocsRender';
import type { MdxDocsRender } from './render/MdxDocsRender';

const { fetch } = global;

const STORY_INDEX_PATH = './index.json';

export type MaybePromise<T> = Promise<T> | T;

export class Preview<TRenderer extends Renderer> {
  /**
   * @deprecated will be removed in 8.0, please use channel instead
   */
  serverChannel?: Channel;

  storyStore: StoryStore<TRenderer>;

  renderToCanvas?: RenderToCanvas<TRenderer>;

  storyRenders: StoryRender<TRenderer>[] = [];

  previewEntryError?: Error;

  constructor(
    public importFn: ModuleImportFn,

    public getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>,

    protected channel: Channel = addons.getChannel()
  ) {
    this.storyStore = new StoryStore();
  }

  // INITIALIZATION
  async initialize() {
    this.setupListeners();

    const projectAnnotations = await this.getProjectAnnotationsOrRenderError();
    return this.initializeWithProjectAnnotations(projectAnnotations);
  }

  setupListeners() {
    this.channel.on(STORY_INDEX_INVALIDATED, this.onStoryIndexChanged.bind(this));
    this.channel.on(UPDATE_GLOBALS, this.onUpdateGlobals.bind(this));
    this.channel.on(UPDATE_STORY_ARGS, this.onUpdateArgs.bind(this));
    this.channel.on(RESET_STORY_ARGS, this.onResetArgs.bind(this));
    this.channel.on(FORCE_RE_RENDER, this.onForceReRender.bind(this));
    this.channel.on(FORCE_REMOUNT, this.onForceRemount.bind(this));
  }

  async getProjectAnnotationsOrRenderError(): Promise<ProjectAnnotations<TRenderer>> {
    try {
      const projectAnnotations = await this.getProjectAnnotations();

      this.renderToCanvas = projectAnnotations.renderToCanvas;
      if (!this.renderToCanvas) {
        throw new Error(dedent`
            Expected your framework's preset to export a \`renderToCanvas\` field.

            Perhaps it needs to be upgraded for Storybook 6.4?

            More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-framework-field
          `);
      }
      return projectAnnotations;
    } catch (err) {
      // This is an error extracting the projectAnnotations (i.e. evaluating the previewEntries) and
      // needs to be show to the user as a simple error
      this.renderPreviewEntryError('Error reading preview.js:', err as Error);
      throw err;
    }
  }

  // If initialization gets as far as project annotations, this function runs.
  async initializeWithProjectAnnotations(projectAnnotations: ProjectAnnotations<TRenderer>) {
    this.storyStore.setProjectAnnotations(projectAnnotations);

    this.setInitialGlobals();

    try {
      const storyIndex = await this.getStoryIndexFromServer();
      return this.initializeWithStoryIndex(storyIndex);
    } catch (err) {
      this.renderPreviewEntryError('Error loading story index:', err as Error);
      throw err;
    }
  }

  async setInitialGlobals() {
    this.emitGlobals();
  }

  emitGlobals() {
    if (!this.storyStore.globals || !this.storyStore.projectAnnotations)
      throw new Error(`Cannot emit before initialization`);

    const payload: SetGlobalsPayload = {
      globals: this.storyStore.globals.get() || {},
      globalTypes: this.storyStore.projectAnnotations.globalTypes || {},
    };
    this.channel.emit(SET_GLOBALS, payload);
  }

  async getStoryIndexFromServer() {
    const result = await fetch(STORY_INDEX_PATH);
    if (result.status === 200) {
      return result.json() as any as StoryIndex;
    }

    throw new Error(await result.text());
  }

  // If initialization gets as far as the story index, this function runs.
  initializeWithStoryIndex(storyIndex: StoryIndex): void {
    if (!this.importFn)
      throw new Error(`Cannot call initializeWithStoryIndex before initialization`);

    this.storyStore.initialize({ storyIndex, importFn: this.importFn });
  }

  // EVENT HANDLERS

  // This happens when a config file gets reloaded
  async onGetProjectAnnotationsChanged({
    getProjectAnnotations,
  }: {
    getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>;
  }) {
    delete this.previewEntryError;
    this.getProjectAnnotations = getProjectAnnotations;

    const projectAnnotations = await this.getProjectAnnotationsOrRenderError();
    if (!this.storyStore.projectAnnotations) {
      await this.initializeWithProjectAnnotations(projectAnnotations);
      return;
    }

    this.storyStore.setProjectAnnotations(projectAnnotations);
    this.emitGlobals();
  }

  async onStoryIndexChanged() {
    delete this.previewEntryError;

    if (!this.storyStore.projectAnnotations) {
      // We haven't successfully set project annotations yet,
      // we need to do that before we can do anything else.
      return;
    }

    try {
      const storyIndex = await this.getStoryIndexFromServer();

      // This is the first time the story index worked, let's load it into the store
      if (!this.storyStore.storyIndex) {
        this.initializeWithStoryIndex(storyIndex);
      }

      // Update the store with the new stories.
      await this.onStoriesChanged({ storyIndex });
    } catch (err) {
      this.renderPreviewEntryError('Error loading story index:', err as Error);
      throw err;
    }
  }

  // This happens when a glob gets HMR-ed
  async onStoriesChanged({
    importFn,
    storyIndex,
  }: {
    importFn?: ModuleImportFn;
    storyIndex?: StoryIndex;
  }) {
    await this.storyStore.onStoriesChanged({ importFn, storyIndex });
  }

  async onUpdateGlobals({ globals }: { globals: Globals }) {
    if (!this.storyStore.globals)
      throw new Error(`Cannot call onUpdateGlobals before initialization`);
    this.storyStore.globals.update(globals);

    await Promise.all(this.storyRenders.map((r) => r.rerender()));

    this.channel.emit(GLOBALS_UPDATED, {
      globals: this.storyStore.globals.get(),
      initialGlobals: this.storyStore.globals.initialGlobals,
    });
  }

  async onUpdateArgs({ storyId, updatedArgs }: { storyId: StoryId; updatedArgs: Args }) {
    this.storyStore.args.update(storyId, updatedArgs);

    await Promise.all(
      this.storyRenders
        .filter((r) => r.id === storyId && !r.renderOptions.forceInitialArgs)
        .map((r) => r.rerender())
    );

    this.channel.emit(STORY_ARGS_UPDATED, {
      storyId,
      args: this.storyStore.args.get(storyId),
    });
  }

  async onResetArgs({ storyId, argNames }: { storyId: string; argNames?: string[] }) {
    // NOTE: we have to be careful here and avoid await-ing when updating a rendered's args.
    // That's because below in `renderStoryToElement` we have also bound to this event and will
    // render the story in the same tick.
    // However, we can do that safely as the current story is available in `this.storyRenders`
    const render = this.storyRenders.find((r) => r.id === storyId);
    const story = render?.story || (await this.storyStore.loadStory({ storyId }));

    const argNamesToReset = argNames || [
      ...new Set([
        ...Object.keys(story.initialArgs),
        ...Object.keys(this.storyStore.args.get(storyId)),
      ]),
    ];

    const updatedArgs = argNamesToReset.reduce((acc, argName) => {
      acc[argName] = story.initialArgs[argName];
      return acc;
    }, {} as Partial<Args>);

    await this.onUpdateArgs({ storyId, updatedArgs });
  }

  // ForceReRender does not include a story id, so we simply must
  // re-render all stories in case they are relevant
  async onForceReRender() {
    await Promise.all(this.storyRenders.map((r) => r.rerender()));
  }

  async onForceRemount({ storyId }: { storyId: StoryId }) {
    await Promise.all(this.storyRenders.filter((r) => r.id === storyId).map((r) => r.remount()));
  }

  // Used by docs to render a story to a given element
  // Note this short-circuits the `prepare()` phase of the StoryRender,
  // main to be consistent with the previous behaviour. In the future,
  // we will change it to go ahead and load the story, which will end up being
  // "instant", although async.
  renderStoryToElement(
    story: PreparedStory<TRenderer>,
    element: TRenderer['canvasElement'],
    callbacks: RenderContextCallbacks<TRenderer>,
    options: StoryRenderOptions
  ) {
    if (!this.renderToCanvas)
      throw new Error(`Cannot call renderStoryToElement before initialization`);

    const render = new StoryRender<TRenderer>(
      this.channel,
      this.storyStore,
      this.renderToCanvas,
      callbacks,
      story.id,
      'docs',
      options,
      story
    );
    render.renderToElement(element);

    this.storyRenders.push(render);

    return async () => {
      await this.teardownRender(render);
    };
  }

  async teardownRender(
    render: StoryRender<TRenderer> | CsfDocsRender<TRenderer> | MdxDocsRender<TRenderer>,
    { viewModeChanged }: { viewModeChanged?: boolean } = {}
  ) {
    this.storyRenders = this.storyRenders.filter((r) => r !== render);
    await render?.teardown?.({ viewModeChanged });
  }

  // API
  async extract(options?: { includeDocsOnly: boolean }) {
    if (this.previewEntryError) {
      throw this.previewEntryError;
    }

    if (!this.storyStore.projectAnnotations) {
      // In v6 mode, if your preview.js throws, we never get a chance to initialize the preview
      // or store, and the error is simply logged to the browser console. This is the best we can do
      throw new Error(dedent`Failed to initialize Storybook.

      Do you have an error in your \`preview.js\`? Check your Storybook's browser console for errors.`);
    }

    await this.storyStore.cacheAllCSFFiles();

    return this.storyStore.extract(options);
  }

  // UTILITIES

  renderPreviewEntryError(reason: string, err: Error) {
    this.previewEntryError = err;
    logger.error(reason);
    logger.error(err);
    this.channel.emit(CONFIG_ERROR, err);
  }
}
