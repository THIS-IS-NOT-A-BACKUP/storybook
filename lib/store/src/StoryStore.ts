import memoize from 'memoizerific';
import {
  Parameters,
  StoryId,
  StoryContextForLoaders,
  AnyFramework,
  GlobalAnnotations,
  ComponentTitle,
} from '@storybook/csf';
import mapValues from 'lodash/mapValues';
import pick from 'lodash/pick';

import { StoriesListStore } from './StoriesListStore';
import { ArgsStore } from './ArgsStore';
import { GlobalsStore } from './GlobalsStore';
import { processCSFFile } from './processCSFFile';
import { prepareStory } from './prepareStory';
import {
  CSFFile,
  ModuleImportFn,
  Story,
  NormalizedGlobalAnnotations,
  Path,
  ExtractOptions,
  ModuleExports,
  BoundStory,
} from './types';
import { HooksContext } from './hooks';
import { normalizeInputTypes } from './normalizeInputTypes';
import { inferArgTypes } from './inferArgTypes';
import { inferControls } from './inferControls';

type MaybePromise<T> = Promise<T> | T;

// TODO -- what are reasonable values for these?
const CSF_CACHE_SIZE = 100;
const STORY_CACHE_SIZE = 1000;

function normalizeGlobalAnnotations<TFramework extends AnyFramework>({
  argTypes,
  globalTypes,
  argTypesEnhancers,
  ...annotations
}: GlobalAnnotations<TFramework>): NormalizedGlobalAnnotations<TFramework> {
  return {
    ...(argTypes && { argTypes: normalizeInputTypes(argTypes) }),
    ...(globalTypes && { globalTypes: normalizeInputTypes(globalTypes) }),
    argTypesEnhancers: [
      ...(argTypesEnhancers || []),
      inferArgTypes,
      // inferControls technically should only run if the user is using the controls addon,
      // and so should be added by a preset there. However, as it seems some code relies on controls
      // annotations (in particular the angular implementation's `cleanArgsDecorator`), for backwards
      // compatibility reasons, we will leave this in the store until 7.0
      inferControls,
    ],
    ...annotations,
  };
}

export class StoryStore<TFramework extends AnyFramework> {
  storiesList: StoriesListStore;

  importFn: ModuleImportFn;

  globalAnnotations: NormalizedGlobalAnnotations<TFramework>;

  globals: GlobalsStore;

  args: ArgsStore;

  hooks: Record<StoryId, HooksContext<TFramework>>;

  cachedCSFFiles?: Record<Path, CSFFile<TFramework>>;

  processCSFFileWithCache: typeof processCSFFile;

  prepareStoryWithCache: typeof prepareStory;

  constructor({
    importFn,
    globalAnnotations,
    fetchStoriesList,
  }: {
    importFn: ModuleImportFn;
    globalAnnotations: GlobalAnnotations<TFramework>;
    fetchStoriesList: ConstructorParameters<typeof StoriesListStore>[0]['fetchStoriesList'];
  }) {
    this.storiesList = new StoriesListStore({ fetchStoriesList });
    this.importFn = importFn;
    this.globalAnnotations = normalizeGlobalAnnotations(globalAnnotations);

    const { globals, globalTypes } = globalAnnotations;
    this.globals = new GlobalsStore({ globals, globalTypes });
    this.args = new ArgsStore();
    this.hooks = {};

    this.processCSFFileWithCache = memoize(CSF_CACHE_SIZE)(processCSFFile) as typeof processCSFFile;
    this.prepareStoryWithCache = memoize(STORY_CACHE_SIZE)(prepareStory) as typeof prepareStory;
  }

  initialize(args: { sync: false; cacheAllCSFFiles?: boolean }): Promise<void>;

  initialize(args: { sync: true; cacheAllCSFFiles?: boolean }): void;

  initialize({
    sync,
    cacheAllCSFFiles = false,
  }: {
    sync: boolean;
    cacheAllCSFFiles?: boolean;
  }): MaybePromise<void> {
    if (sync) {
      this.storiesList.initialize(true);
      if (cacheAllCSFFiles) {
        this.cacheAllCSFFiles(true);
      }
      return null;
    }

    return this.storiesList
      .initialize(false)
      .then(() => (cacheAllCSFFiles ? this.cacheAllCSFFiles(false) : null));
  }

  updateGlobalAnnotations(globalAnnotations: GlobalAnnotations<TFramework>) {
    this.globalAnnotations = normalizeGlobalAnnotations(globalAnnotations);
    const { globals, globalTypes } = globalAnnotations;
    this.globals.resetOnGlobalAnnotationsChange({ globals, globalTypes });
  }

  async onImportFnChanged({ importFn }: { importFn: ModuleImportFn }) {
    this.importFn = importFn;

    // We need to refetch the stories list as it may have changed too
    await this.storiesList.cacheStoriesList(false);

    if (this.cachedCSFFiles) {
      await this.cacheAllCSFFiles(false);
    }
  }

  loadCSFFileByStoryId(args: { storyId: StoryId; sync: false }): Promise<CSFFile<TFramework>>;

  loadCSFFileByStoryId(args: { storyId: StoryId; sync: true }): CSFFile<TFramework>;

  loadCSFFileByStoryId({
    storyId,
    sync,
  }: {
    storyId: StoryId;
    sync: boolean;
  }): MaybePromise<CSFFile<TFramework>> {
    const { importPath, title } = this.storiesList.storyIdToMetadata(storyId);
    const moduleExportsOrPromise = this.importFn(importPath);

    const isPromise = Promise.resolve(moduleExportsOrPromise) === moduleExportsOrPromise;
    if (!isPromise) {
      return this.processCSFFileWithCache(moduleExportsOrPromise as ModuleExports, title);
    }

    if (sync) {
      throw new Error(
        `importFn() returned a promise, did you pass an async version then call initializeSync()?`
      );
    }

    return (moduleExportsOrPromise as Promise<ModuleExports>).then((moduleExports) =>
      this.processCSFFileWithCache(moduleExports, title)
    );
  }

  loadAllCSFFiles(sync: false): Promise<StoryStore<TFramework>['cachedCSFFiles']>;

  loadAllCSFFiles(sync: true): StoryStore<TFramework>['cachedCSFFiles'];

  loadAllCSFFiles(sync: boolean): MaybePromise<StoryStore<TFramework>['cachedCSFFiles']> {
    const importPaths: Record<Path, StoryId> = {};
    Object.entries(this.storiesList.storiesList.stories).forEach(([storyId, { importPath }]) => {
      importPaths[importPath] = storyId;
    });

    const csfFileList = Object.entries(importPaths).map(([importPath, storyId]) => ({
      importPath,
      csfFileOrPromise: sync
        ? this.loadCSFFileByStoryId({ storyId, sync: true })
        : this.loadCSFFileByStoryId({ storyId, sync: false }),
    }));

    function toObject(list: { importPath: Path; csfFile: CSFFile<TFramework> }[]) {
      return list.reduce((acc, { importPath, csfFile }) => {
        acc[importPath] = csfFile;
        return acc;
      }, {} as Record<Path, CSFFile<TFramework>>);
    }

    if (sync) {
      return toObject(
        csfFileList.map(({ importPath, csfFileOrPromise }) => ({
          importPath,
          csfFile: csfFileOrPromise,
        })) as { importPath: Path; csfFile: CSFFile<TFramework> }[]
      );
    }
    return Promise.all(
      csfFileList.map(async ({ importPath, csfFileOrPromise }) => ({
        importPath,
        csfFile: await csfFileOrPromise,
      }))
    ).then(toObject);
  }

  cacheAllCSFFiles(sync: false): Promise<void>;

  cacheAllCSFFiles(sync: true): void;

  cacheAllCSFFiles(sync: boolean): MaybePromise<void> {
    if (sync) {
      this.cachedCSFFiles = this.loadAllCSFFiles(true);
      return null;
    }
    return this.loadAllCSFFiles(false).then((csfFiles) => {
      this.cachedCSFFiles = csfFiles;
    });
  }

  async loadStory({ storyId }: { storyId: StoryId }): Promise<Story<TFramework>> {
    const csfFile = await this.loadCSFFileByStoryId({ storyId, sync: false });
    return this.storyFromCSFFile({ storyId, csfFile });
  }

  storyFromCSFFile({
    storyId,
    csfFile,
  }: {
    storyId: StoryId;
    csfFile: CSFFile<TFramework>;
  }): Story<TFramework> {
    const storyAnnotations = csfFile.stories[storyId];
    if (!storyAnnotations) {
      throw new Error(`Didn't find '${storyId}' in CSF file, this is unexpected`);
    }
    const componentAnnotations = csfFile.meta;

    const story = this.prepareStoryWithCache(
      storyAnnotations,
      componentAnnotations,
      this.globalAnnotations
    );
    this.args.setInitial(story.id, story.initialArgs);
    this.hooks[story.id] = new HooksContext();
    return story;
  }

  componentStoriesFromCSFFile({ csfFile }: { csfFile: CSFFile<TFramework> }): Story<TFramework>[] {
    return Object.keys(csfFile.stories).map((storyId: StoryId) =>
      this.storyFromCSFFile({ storyId, csfFile })
    );
  }

  getStoryContext(story: Story<TFramework>): Omit<StoryContextForLoaders<TFramework>, 'viewMode'> {
    return {
      ...story,
      args: this.args.get(story.id),
      globals: this.globals.get(),
      hooks: this.hooks[story.id] as unknown,
    };
  }

  cleanupStory(story: Story<TFramework>): void {
    this.hooks[story.id].clean();
  }

  extract(options: ExtractOptions = { includeDocsOnly: false }) {
    if (!this.cachedCSFFiles) {
      throw new Error('Cannot call extract() unless you call cacheAllCSFFiles() first.');
    }

    return Object.entries(this.storiesList.storiesList.stories)
      .map(([storyId, { importPath }]) => {
        const csfFile = this.cachedCSFFiles[importPath];
        const story = this.storyFromCSFFile({ storyId, csfFile });

        if (!options.includeDocsOnly && story.parameters.docsOnly) {
          return false;
        }

        return Object.entries(story).reduce((acc, [key, value]) => {
          if (typeof value === 'function') {
            return acc;
          }
          if (['hooks'].includes(key)) {
            return acc;
          }
          if (Array.isArray(value)) {
            return Object.assign(acc, { [key]: value.slice().sort() });
          }
          return Object.assign(acc, { [key]: value });
        }, {});
      })
      .filter(Boolean);
  }

  getSetStoriesPayload() {
    const stories = this.extract({ includeDocsOnly: true });

    const kindParameters: Parameters = stories.reduce(
      (acc: Parameters, { title }: { title: ComponentTitle }) => {
        acc[title] = {};
        return acc;
      },
      {} as Parameters
    );

    return {
      v: 2,
      globals: this.globals.get(),
      globalParameters: {},
      kindParameters,
      stories,
    };
  }

  getStoriesJsonData = () => {
    const value = this.getSetStoriesPayload();
    const allowedParameters = ['fileName', 'docsOnly', 'framework', '__id', '__isArgsStory'];

    return {
      v: 2,
      globalParameters: pick(value.globalParameters, allowedParameters),
      kindParameters: mapValues(value.kindParameters, (v) => pick(v, allowedParameters)),
      stories: mapValues(value.stories, (v: any) => ({
        ...pick(v, ['id', 'name', 'kind', 'story']),
        parameters: pick(v.parameters, allowedParameters),
      })),
    };
  };

  raw() {
    return this.extract().map(({ id }: { id: StoryId }) => this.fromId(id));
  }

  fromId(storyId: StoryId): BoundStory<TFramework> {
    if (!this.cachedCSFFiles) {
      throw new Error('Cannot call fromId/raw() unless you call cacheAllCSFFiles() first.');
    }

    const { importPath } = this.storiesList.storyIdToMetadata(storyId);
    if (!importPath) {
      throw new Error(`Unknown storyId ${storyId}`);
    }
    const csfFile = this.cachedCSFFiles[importPath];
    const story = this.storyFromCSFFile({ storyId, csfFile });
    return {
      ...story,
      storyFn: (context) =>
        story.unboundStoryFn({
          ...this.getStoryContext(story),
          viewMode: 'story',
          ...context,
        }),
    };
  }
}
