import { screen } from '@testing-library/react-native';

import { renderThemed, resetSettings } from '../testing/utils';
import HomeScreen from '../app/(tabs)/index';

beforeEach(() => resetSettings('en'));

describe('Home tab', () => {
  it('shows the name, tagline, today and an honest coming-soon state', async () => {
    await renderThemed(<HomeScreen />);

    expect(screen.getByText('Puja Saathi')).toBeTruthy();
    expect(screen.getByText('Har Puja Ki Samagri, Vidhi Aur Taiyari')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByTestId('home-date').props.children).toMatch(/2\d{3}/);
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByText('Your puja guides are on the way')).toBeTruthy();
  });

  it('renders in Hindi', async () => {
    await resetSettings('hi');
    await renderThemed(<HomeScreen />);
    expect(screen.getByText('पूजा साथी')).toBeTruthy();
    expect(screen.getByText('आज')).toBeTruthy();
    expect(screen.getByText('जल्द आ रहा है')).toBeTruthy();
  });
});
