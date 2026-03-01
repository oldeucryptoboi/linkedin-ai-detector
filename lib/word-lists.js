window.AIDetector = window.AIDetector || {};

window.AIDetector.wordLists = (() => {
  // Abstract/vague words commonly overused by AI
  const abstractWords = new Set([
    'leverage', 'synergy', 'ecosystem', 'paradigm', 'transformative',
    'innovative', 'disruptive', 'holistic', 'scalable', 'sustainable',
    'actionable', 'impactful', 'streamline', 'optimize', 'empower',
    'navigate', 'landscape', 'journey', 'unlock', 'harness',
    'foster', 'cultivate', 'elevate', 'amplify', 'catalyze',
    'pivotal', 'robust', 'seamless', 'dynamic', 'cutting-edge',
    'thought-leadership', 'best-in-class', 'world-class', 'next-level',
    'game-changing', 'groundbreaking', 'unprecedented', 'unparalleled',
    'sovereignty', 'agentic', 'democratize', 'operationalize',
    'contextualize', 'incentivize', 'prioritize', 'revolutionize',
    'spearhead', 'champion', 'reimagine', 'redefine', 'rethink',
    'reshape', 'recalibrate', 'realign', 'blueprint', 'roadmap',
    'north-star', 'moonshot', 'flywheel', 'moat', 'tailwind',
    'headwind', 'inflection', 'traction', 'bandwidth', 'alignment',
    'stakeholder', 'mindset', 'framework', 'methodology', 'ecosystem',
    'infrastructure', 'architecture', 'modality', 'verticalize',
    'hyperscale', 'hyperautomation', 'supercharge', 'turbocharge',
    'skyrocket', 'exponential', 'monumental', 'seismic', 'tectonic'
  ]);

  // Transitional phrases that AI overuses at sentence starts
  const transitionPhrases = [
    'moreover', 'furthermore', 'additionally', 'in addition',
    'consequently', 'as a result', 'therefore', 'thus',
    'however', 'nevertheless', 'nonetheless', 'on the other hand',
    'in contrast', 'conversely', 'similarly', 'likewise',
    'in particular', 'specifically', 'notably', 'importantly',
    'in fact', 'indeed', 'certainly', 'undoubtedly',
    'essentially', 'fundamentally', 'ultimately', 'in essence',
    'that said', 'that being said', 'with that in mind',
    'to that end', 'to this end', 'in this regard',
    'moving forward', 'going forward', 'looking ahead',
    'it is worth noting', 'it\'s worth noting',
    'it is important to note', 'it\'s important to note',
    'interestingly', 'surprisingly', 'remarkably',
    'to put it simply', 'simply put', 'put simply',
    'in other words', 'that is to say'
  ];

  // Known AI filler phrases with individual diagnostic weights (0-1)
  // Higher weight = more diagnostic of AI
  const genericPhrases = [
    { phrase: 'let\'s dive in', weight: 0.95 },
    { phrase: 'let\'s dive into', weight: 0.90 },
    { phrase: 'let\'s break it down', weight: 0.85 },
    { phrase: 'let\'s break this down', weight: 0.85 },
    { phrase: 'let\'s unpack', weight: 0.85 },
    { phrase: 'game-changer', weight: 0.70 },
    { phrase: 'game changer', weight: 0.70 },
    { phrase: 'here\'s the thing', weight: 0.60 },
    { phrase: 'here is the thing', weight: 0.60 },
    { phrase: 'here\'s why', weight: 0.50 },
    { phrase: 'here\'s what', weight: 0.45 },
    { phrase: 'the bottom line', weight: 0.55 },
    { phrase: 'bottom line', weight: 0.50 },
    { phrase: 'at the end of the day', weight: 0.65 },
    { phrase: 'in today\'s rapidly', weight: 0.90 },
    { phrase: 'in today\'s fast-paced', weight: 0.85 },
    { phrase: 'in today\'s world', weight: 0.60 },
    { phrase: 'in today\'s landscape', weight: 0.85 },
    { phrase: 'the future of', weight: 0.40 },
    { phrase: 'the reality is', weight: 0.55 },
    { phrase: 'the truth is', weight: 0.50 },
    { phrase: 'it\'s not about', weight: 0.45 },
    { phrase: 'it\'s about', weight: 0.35 },
    { phrase: 'this is why', weight: 0.35 },
    { phrase: 'this is how', weight: 0.35 },
    { phrase: 'think about it', weight: 0.50 },
    { phrase: 'let that sink in', weight: 0.80 },
    { phrase: 'food for thought', weight: 0.65 },
    { phrase: 'what do you think', weight: 0.30 },
    { phrase: 'i\'d love to hear', weight: 0.55 },
    { phrase: 'drop a comment', weight: 0.60 },
    { phrase: 'agree or disagree', weight: 0.70 },
    { phrase: 'hot take', weight: 0.40 },
    { phrase: 'unpopular opinion', weight: 0.35 },
    { phrase: 'spoiler alert', weight: 0.40 },
    { phrase: 'plot twist', weight: 0.50 },
    { phrase: 'pro tip', weight: 0.40 },
    { phrase: 'the secret', weight: 0.40 },
    { phrase: 'nobody talks about', weight: 0.65 },
    { phrase: 'no one is talking about', weight: 0.65 },
    { phrase: 'stop doing', weight: 0.45 },
    { phrase: 'start doing', weight: 0.45 },
    { phrase: 'here are', weight: 0.30 },
    { phrase: 'buckle up', weight: 0.55 },
    { phrase: 'strap in', weight: 0.50 }
  ];

  // Contrast hook patterns (regex patterns)
  const contrastHookPatterns = [
    /^(?:the )?(?:real )?question isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?problem isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?answer isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?issue isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?challenge isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?secret isn'?t .{3,}, (?:it'?s|but) /i,
    /^(?:the )?goal isn'?t .{3,}, (?:it'?s|but) /i,
    /^everyone (?:is |thinks |says |believes ).{3,}(?:but|yet|however)/i,
    /^most (?:people|leaders|companies|founders|teams) .{3,}(?:but|yet|instead)/i,
    /^we'?ve been .{3,} (?:wrong|all wrong|backwards)/i,
    /^forget (?:everything )?(?:you know|what you'?ve heard|about)/i,
    /^what if .{3,} (?:was|were|isn'?t|is) (?:actually|really)/i,
    /^stop .{3,}\. start .{3,}\./i,
    /^(?:unpopular|controversial) (?:opinion|take|thought):/i
  ];

  // Emotional/emphatic markers humans use but AI tends to avoid
  const emotionalMarkers = [
    'lol', 'lmao', 'haha', 'omg', 'wow', 'damn', 'shit', 'hell',
    'tbh', 'imo', 'imho', 'ngl', 'fr', 'smh', 'fwiw', 'btw',
    '!!!', '??', '!?', '...'
  ];

  return {
    abstractWords,
    transitionPhrases,
    genericPhrases,
    contrastHookPatterns,
    emotionalMarkers
  };
})();
