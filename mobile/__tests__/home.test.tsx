import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../app/index';

describe('HomeScreen', () => {
  it('renders the app title and tagline', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Puja Saathi')).toBeTruthy();
    expect(screen.getByText('Har Puja Ki Samagri, Vidhi Aur Taiyari')).toBeTruthy();
  });
});
