import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_500Medium,
  AtkinsonHyperlegibleNext_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeProvider } from './src/data/HomeProvider';
import { HomeScreen } from './src/ui/HomeScreen';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_700Bold,
  });

  // Jos fontti ei lataudu, jatketaan järjestelmäfontilla.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <HomeProvider>
        <HomeScreen />
        <StatusBar style="auto" />
      </HomeProvider>
    </SafeAreaProvider>
  );
}
