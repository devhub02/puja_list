const en = {
  app: {
    name: 'Puja Saathi',
    tagline: 'Har Puja Ki Samagri, Vidhi Aur Taiyari',
  },
  tabs: {
    home: 'Home',
    library: 'Library',
    preparation: 'My Preparation',
    settings: 'Settings',
  },
  home: {
    todayLabel: 'Today',
    emptyTitle: 'Your puja guides are on the way',
    emptyBody:
      'Soon you will find festival and puja guides here: what they mean, what you need, and how to prepare, step by step.',
    comingSoon: 'Coming soon',
  },
  library: {
    title: 'Library',
    emptyTitle: 'The puja library is being prepared',
    emptyBody:
      'Pujas and festivals from across India will be listed here, each with its samagri and vidhi. Nothing to browse yet.',
  },
  preparation: {
    title: 'My Preparation',
    emptyTitle: 'Nothing to prepare yet',
    emptyBody:
      'Once pujas are available, the ones you save and your preparation checklists will appear here.',
  },
  settings: {
    title: 'Settings',
    language: {
      title: 'Language',
      description: 'Choose the language of the app.',
    },
    appearance: {
      title: 'Appearance',
    },
    theme: {
      title: 'Theme',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    textSize: {
      title: 'Text size',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      extraLarge: 'Extra large',
    },
    preview: {
      title: 'Preview',
      heading: 'Satyanarayan Puja',
      body: 'Light a lamp, place the idol or picture on a clean seat, and keep the samagri within reach before you begin.',
    },
    about: {
      title: 'About',
      version: 'App version',
      contentVersion: 'Content version',
      pujaCount: 'Pujas in this version',
      contentUnavailable: 'Not loaded',
      description:
        'Puja Saathi helps you prepare for pujas and festivals across India: significance, samagri, step-by-step vidhi and checklists.',
      offline: 'All puja content is stored inside the app and works without internet.',
      deviceOnly: 'Your settings are saved only on this phone.',
      reviewNote:
        'Content is written in our own words and carries a review label until it is verified by an expert.',
    },
    disclaimer: {
      title: 'Please note',
      body: 'Vidhi and samagri can differ by region, family tradition, sampradaya and the way a puja is performed. Adjust the details according to your own family tradition.',
    },
  },
  startup: {
    errorTitle: 'Could not open the puja library',
    errorBody:
      'Something went wrong while preparing the content stored on this phone. Your saved data is safe. Please try again.',
    retry: 'Try again',
    retrying: 'Trying again…',
  },
  a11y: {
    selected: 'selected',
    appLogo: 'Puja Saathi logo',
  },
};

export default en;

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

/** Shape every locale file must follow. */
export type Translations = DeepString<typeof en>;
