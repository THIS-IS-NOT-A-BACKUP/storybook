// this file is generated by generate-exports-file.ts
// this is done to prevent runtime dependencies from making it's way into the build/start script of the manager
// the manager builder needs to know which dependencies are 'globalized' in the ui

export default {
  '@storybook/addons': [
    'AddonStore',
    'HooksContext',
    'addons',
    'applyHooks',
    'isSupportedType',
    'makeDecorator',
    'mockChannel',
    'types',
    'useArgs',
    'useCallback',
    'useChannel',
    'useEffect',
    'useGlobals',
    'useMemo',
    'useParameter',
    'useReducer',
    'useRef',
    'useState',
    'useStoryContext',
  ],
  '@storybook/channel-postmessage': ['KEY', 'PostmsgTransport', 'createChannel'],
  '@storybook/channel-websocket': ['WebsocketTransport', 'createChannel'],
  '@storybook/channels': ['Channel'],
  '@storybook/client-api': [
    'ClientApi',
    'addArgTypes',
    'addArgTypesEnhancer',
    'addArgs',
    'addArgsEnhancer',
    'addDecorator',
    'addLoader',
    'addParameters',
    'addStepRunner',
    'getQueryParam',
    'getQueryParams',
    'setGlobalRender',
    'DEEPLY_EQUAL',
    'HooksContext',
    'NO_TARGET_NAME',
    'StoryStore',
    'applyHooks',
    'combineArgs',
    'combineParameters',
    'composeConfigs',
    'composeStepRunners',
    'composeStories',
    'composeStory',
    'decorateStory',
    'deepDiff',
    'defaultDecorateStory',
    'filterArgTypes',
    'getArrayField',
    'getField',
    'getObjectField',
    'getSingletonField',
    'getValuesFromArgTypes',
    'groupArgsByTarget',
    'inferControls',
    'mapArgsToTypes',
    'noTargetArgs',
    'normalizeComponentAnnotations',
    'normalizeInputType',
    'normalizeInputTypes',
    'normalizeProjectAnnotations',
    'normalizeStory',
    'prepareStory',
    'processCSFFile',
    'sanitizeStoryContextUpdate',
    'setProjectAnnotations',
    'sortStoriesV6',
    'sortStoriesV7',
    'useAddonState',
    'useArgs',
    'useCallback',
    'useChannel',
    'useEffect',
    'useGlobals',
    'useMemo',
    'useParameter',
    'useReducer',
    'useRef',
    'useSharedState',
    'useState',
    'useStoryContext',
    'userOrAutoTitle',
    'userOrAutoTitleFromSpecifier',
    'validateOptions',
  ],
  '@storybook/client-logger': ['deprecate', 'logger', 'once', 'pretty'],
  '@storybook/core-client': ['ClientApi', 'StoryStore', 'start'],
  '@storybook/core-events': [
    'CHANNEL_CREATED',
    'CONFIG_ERROR',
    'CURRENT_STORY_WAS_SET',
    'DOCS_RENDERED',
    'FORCE_REMOUNT',
    'FORCE_RE_RENDER',
    'GLOBALS_UPDATED',
    'IGNORED_EXCEPTION',
    'NAVIGATE_URL',
    'PLAY_FUNCTION_THREW_EXCEPTION',
    'PRELOAD_ENTRIES',
    'PREVIEW_BUILDER_PROGRESS',
    'PREVIEW_KEYDOWN',
    'REGISTER_SUBSCRIPTION',
    'RESET_STORY_ARGS',
    'SELECT_STORY',
    'SET_CONFIG',
    'SET_CURRENT_STORY',
    'SET_GLOBALS',
    'SET_INDEX',
    'SET_STORIES',
    'SHARED_STATE_CHANGED',
    'SHARED_STATE_SET',
    'STORIES_COLLAPSE_ALL',
    'STORIES_EXPAND_ALL',
    'STORY_ARGS_UPDATED',
    'STORY_CHANGED',
    'STORY_ERRORED',
    'STORY_INDEX_INVALIDATED',
    'STORY_MISSING',
    'STORY_PREPARED',
    'STORY_RENDERED',
    'STORY_RENDER_PHASE_CHANGED',
    'STORY_SPECIFIED',
    'STORY_THREW_EXCEPTION',
    'STORY_UNCHANGED',
    'UPDATE_GLOBALS',
    'UPDATE_QUERY_PARAMS',
    'UPDATE_STORY_ARGS',
  ],
  '@storybook/preview-web': [
    'DocsContext',
    'Preview',
    'PreviewWeb',
    'PreviewWithSelection',
    'composeConfigs',
    'simulateDOMContentLoaded',
    'simulatePageLoad',
  ],
  '@storybook/store': [
    'DEEPLY_EQUAL',
    'HooksContext',
    'NO_TARGET_NAME',
    'StoryStore',
    'applyHooks',
    'combineArgs',
    'combineParameters',
    'composeConfigs',
    'composeStepRunners',
    'composeStories',
    'composeStory',
    'decorateStory',
    'deepDiff',
    'defaultDecorateStory',
    'filterArgTypes',
    'getArrayField',
    'getField',
    'getObjectField',
    'getSingletonField',
    'getValuesFromArgTypes',
    'groupArgsByTarget',
    'inferControls',
    'mapArgsToTypes',
    'noTargetArgs',
    'normalizeComponentAnnotations',
    'normalizeInputType',
    'normalizeInputTypes',
    'normalizeProjectAnnotations',
    'normalizeStory',
    'prepareStory',
    'processCSFFile',
    'sanitizeStoryContextUpdate',
    'setProjectAnnotations',
    'sortStoriesV6',
    'sortStoriesV7',
    'useAddonState',
    'useArgs',
    'useCallback',
    'useChannel',
    'useEffect',
    'useGlobals',
    'useMemo',
    'useParameter',
    'useReducer',
    'useRef',
    'useSharedState',
    'useState',
    'useStoryContext',
    'userOrAutoTitle',
    'userOrAutoTitleFromSpecifier',
    'validateOptions',
  ],
} as const;
