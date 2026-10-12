export const inkCardScenes = ['landscape', 'fish', 'shrimp', 'splash', 'ripples', 'trees', 'grasses', 'lotus', 'river'] as const;
export const dayInkCardScenes = ['landscape', 'fish-shrimp', 'trees', 'grasses', 'lotus', 'river'] as const;
export type InkCardScene = typeof inkCardScenes[number] | typeof dayInkCardScenes[number];

export function inkCardScene(index: number, mode: 'dark' | 'day' = 'dark'): InkCardScene {
  const scenes = mode === 'day' ? dayInkCardScenes : inkCardScenes;
  return scenes[index % scenes.length];
}
