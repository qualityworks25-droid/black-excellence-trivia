/** Rotating seed topics fed to the generation worker, grouped by question_bank category. */
export const SEED_TOPICS = {
  stem_excellence: [
    '19th-century Black inventors',
    'Black mathematicians who worked at NASA',
    "Dr. Kizzmekia Corbett and mRNA vaccine research",
    'Black surgeons and medical firsts',
    'Black chemists and pharmacology breakthroughs',
    'Black astronauts and aerospace engineers',
    'Black computer scientists and software pioneers',
  ],
  business_real_estate: [
    'Oprah Winfrey\'s media and business empire',
    'Jay-Z and Roc-A-Fella / Roc Nation business ventures',
    'Black-owned real estate development firms',
    'Black-owned bank and financial institution history',
    'Black fashion and beauty industry entrepreneurs',
    'Historic Black Wall Street businesses',
  ],
  thriving_communities: [
    'Baldwin Hills, CA real estate and history',
    'Bowie, MD community history',
    'Olympia Fields, IL community history',
    'Atlanta, GA Black business and cultural history',
    'Historic Black townships and communities in the U.S.',
    'Prince George\'s County, MD affluent Black communities',
  ],
  entertainment_culture: [
    'Pioneers of Hip-Hop in the 1970s-80s',
    'Motown Records artists and producers',
    'R&B innovators of the 1990s',
    'Rap lyricism and influential albums',
    'Black film directors and Hollywood pioneers',
    'Black-owned record labels',
  ],
};

export function pickRandomSeedTopic(category) {
  const topics = SEED_TOPICS[category];
  return topics[Math.floor(Math.random() * topics.length)];
}

export function allCategories() {
  return Object.keys(SEED_TOPICS);
}
