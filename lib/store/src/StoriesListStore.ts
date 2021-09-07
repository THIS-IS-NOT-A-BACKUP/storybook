import { Channel } from '@storybook/addons';
import { StoryId } from '@storybook/csf';

import { StorySpecifier, Path, StoriesList, StoriesListStory } from './types';

export class StoriesListStore {
  fetchStoriesList: () => Promise<StoriesList> | StoriesList;

  channel: Channel;

  storiesList: StoriesList;

  constructor({ fetchStoriesList }: { fetchStoriesList: StoriesListStore['fetchStoriesList'] }) {
    this.fetchStoriesList = fetchStoriesList;
  }

  initialize(sync: false): Promise<void>;

  initialize(sync: true): void;

  initialize(sync: boolean) {
    return sync ? this.cacheStoriesList(true) : this.cacheStoriesList(false);
  }

  async onStoriesChanged() {
    this.storiesList = await this.fetchStoriesList();
  }

  cacheStoriesList(sync: false): Promise<void>;

  cacheStoriesList(sync: true): void;

  cacheStoriesList(sync: boolean): Promise<void> | void {
    const fetchResult = this.fetchStoriesList();

    if (sync) {
      this.storiesList = fetchResult as StoriesList;
      if (!this.storiesList.v) {
        throw new Error(
          `fetchStoriesList() didn't return a stories list, did you pass an async version then call initializeSync()?`
        );
      }
      return null;
    }

    return Promise.resolve(fetchResult).then((storiesList) => {
      this.storiesList = storiesList;
    });
  }

  storyIdFromSpecifier(specifier: StorySpecifier) {
    const storyIds = Object.keys(this.storiesList.stories);
    if (specifier === '*') {
      // '*' means select the first story. If there is none, we have no selection.
      return storyIds[0];
    }

    if (typeof specifier === 'string') {
      // Find the story with the exact id that matches the specifier (see #11571)
      if (storyIds.indexOf(specifier) >= 0) {
        return specifier;
      }
      // Fallback to the first story that starts with the specifier
      return storyIds.find((storyId) => storyId.startsWith(specifier));
    }

    // Try and find a story matching the name/kind, setting no selection if they don't exist.
    const { name, title } = specifier;
    const match = Object.entries(this.storiesList.stories).find(
      ([id, story]) => story.name === name && story.title === title
    );

    return match && match[0];
  }

  storyIdToMetadata(storyId: StoryId): StoriesListStory {
    const storyMetadata = this.storiesList.stories[storyId];
    if (!storyMetadata) {
      throw new Error(`Didn't find '${storyId}' in story metadata (\`stories.json\`)`);
    }

    return storyMetadata;
  }
}
