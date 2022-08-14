export default {
  'cra/default-js': {
    name: 'Create React App (Javascript)',
    script: 'npx create-react-app .',
    expected: {
      framework: '@storybook/cra',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
  },
  'cra/default-ts': {
    name: 'Create React App (Typescript)',
    script: 'npx create-react-app . --template typescript',
    expected: {
      framework: '@storybook/cra',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
  },
  'angular/latest': {
    name: 'Angular (latest)',
    script:
      'npx -p @angular/cli ng new angular-latest --directory . --routing=true --minimal=true --style=scss --skip-install=true --strict',
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
  },
} as const;
