export interface PhysicalTraits {
  ethnicity: string;
  skinTone: string; // Fitzpatrick scale description
  age: string; // age range description
  bodyType: string;
  height: string;
  build: string;
  hairType: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  eyeShape: string;
  facialStructure: string;
  distinctiveFeatures: string[];
  clothingStyle: string;
  colorPalette: string[];
}

export interface CanonicalCharacterDescription {
  visualDescriptors: string; // Comprehensive canonical description
  alwaysTraits: string; // Immutable characteristics that must stay consistent
  neverTraits: string; // Characteristics this character should never have
  colorScheme: string; // Character's signature color palette
}

export class CharacterDescriptorService {
  
  private ethnicityTemplates = {
    "East Asian": {
      skinTones: ["light warm undertone (Type II)", "light neutral undertone (Type II)", "light olive undertone (Type III)", "medium warm undertone (Type III)"],
      eyeShapes: ["monolid", "hooded", "almond-shaped", "slightly upturned"],
      facialStructures: ["heart-shaped face", "oval face", "round face", "square jawline with softer features"],
      hairTypes: ["straight", "slightly wavy", "thick straight"],
      commonHairColors: ["jet black", "dark brown", "black-brown", "deep chestnut brown"]
    },
    
    "South Asian": {
      skinTones: ["light olive undertone (Type III)", "medium warm undertone (Type IV)", "medium golden undertone (Type IV)", "deep warm undertone (Type V)"],
      eyeShapes: ["large almond-shaped", "deep-set", "wide-set", "expressive round"],
      facialStructures: ["oval face with defined cheekbones", "heart-shaped face", "long oval face", "strong jawline"],
      hairTypes: ["thick straight", "wavy", "curly", "coily"],
      commonHairColors: ["jet black", "deep brown", "dark chocolate brown", "black with brown highlights"]
    },
    
    "Middle Eastern": {
      skinTones: ["light olive undertone (Type III)", "medium olive undertone (Type IV)", "deep olive undertone (Type V)", "light warm undertone (Type II)"],
      eyeShapes: ["large expressive", "almond-shaped", "deep-set", "slightly hooded"],
      facialStructures: ["strong angular features", "oval face with prominent cheekbones", "square jawline", "refined features"],
      hairTypes: ["thick wavy", "curly", "straight", "coily"],
      commonHairColors: ["deep black", "dark brown", "chestnut brown", "black-brown"]
    },
    
    "African": {
      skinTones: ["deep rich undertone (Type VI)", "deep warm undertone (Type V)", "dark golden undertone (Type V)", "very deep undertone (Type VI)"],
      eyeShapes: ["large round", "almond-shaped", "wide-set", "expressive"],
      facialStructures: ["strong cheekbones", "oval face", "heart-shaped face", "angular jawline"],
      hairTypes: ["coily", "kinky", "tightly curled", "4c texture"],
      commonHairColors: ["jet black", "dark brown", "deep black", "natural black"]
    },
    
    "European": {
      skinTones: ["very light (Type I)", "light neutral (Type II)", "light warm (Type II)", "medium neutral (Type III)"],
      eyeShapes: ["round", "almond-shaped", "hooded", "deep-set"],
      facialStructures: ["oval face", "square jawline", "heart-shaped face", "angular features"],
      hairTypes: ["straight", "wavy", "curly", "fine"],
      commonHairColors: ["blonde", "light brown", "dark brown", "auburn", "strawberry blonde", "chestnut brown"]
    },
    
    "Nordic": {
      skinTones: ["very light cool undertone (Type I)", "light cool undertone (Type II)", "light neutral (Type II)", "medium cool (Type III)"],
      eyeShapes: ["round", "slightly hooded", "deep-set", "almond-shaped"],
      facialStructures: ["angular features", "square jawline", "oval face", "strong cheekbones"],
      hairTypes: ["straight", "slightly wavy", "fine", "thick straight"],
      commonHairColors: ["platinum blonde", "ash blonde", "light brown", "strawberry blonde", "golden blonde"]
    },
    
    "Latino": {
      skinTones: ["light warm undertone (Type II)", "medium warm undertone (Type III)", "medium golden (Type IV)", "light olive (Type III)"],
      eyeShapes: ["large expressive", "almond-shaped", "round", "slightly upturned"],
      facialStructures: ["heart-shaped face", "oval face", "strong cheekbones", "soft jawline"],
      hairTypes: ["wavy", "curly", "straight", "thick"],
      commonHairColors: ["dark brown", "black", "chestnut brown", "deep auburn"]
    },
    
    "Slavic": {
      skinTones: ["light neutral undertone (Type II)", "medium cool undertone (Type III)", "light cool (Type II)", "light warm (Type II)"],
      eyeShapes: ["deep-set", "almond-shaped", "round", "slightly hooded"],
      facialStructures: ["strong angular features", "high cheekbones", "square jawline", "oval face"],
      hairTypes: ["straight", "wavy", "thick", "fine"],
      commonHairColors: ["ash blonde", "dark blonde", "light brown", "chestnut brown", "dark brown"]
    }
  };

  private ageDescriptors = {
    "young adult": {
      ageRange: "early 20s",
      facialFeatures: "youthful smooth skin, bright eyes, defined jawline",
      bodyDescription: "lean and energetic build"
    },
    "adult": {
      ageRange: "late 20s to early 30s", 
      facialFeatures: "mature defined features, clear skin with subtle character lines",
      bodyDescription: "fit and well-proportioned build"
    },
    "mature adult": {
      ageRange: "mid 30s to 40s",
      facialFeatures: "distinguished features with some fine lines, confident expression",
      bodyDescription: "strong and established build"
    },
    "middle-aged": {
      ageRange: "40s to early 50s",
      facialFeatures: "seasoned features with laugh lines, wise eyes",
      bodyDescription: "solid and experienced build"
    }
  };

  private bodyTypes = {
    "petite": "small-framed and delicate build",
    "slender": "tall and lean with graceful proportions", 
    "athletic": "toned and muscular with strong shoulders",
    "average": "balanced proportions with healthy build",
    "curvy": "fuller figure with defined waist",
    "stocky": "broad-shouldered and solid build",
    "tall": "notably tall with long limbs"
  };

  private clothingStyles = {
    "professional": "tailored suits, crisp shirts, polished appearance",
    "casual": "comfortable jeans, fitted t-shirts, relaxed style",
    "bohemian": "flowing fabrics, layered accessories, artistic flair",
    "edgy": "leather jackets, dark colors, bold accessories", 
    "elegant": "sophisticated dresses, refined accessories, classic style",
    "sporty": "athletic wear, comfortable sneakers, active appearance",
    "vintage": "retro-inspired clothing, classic patterns, timeless style",
    "minimalist": "clean lines, neutral colors, simple elegant pieces"
  };

  private distinctiveFeatures = [
    "small scar above left eyebrow",
    "beauty mark on right cheek", 
    "slightly crooked nose",
    "deep dimples when smiling",
    "heterochromia (different colored eyes)",
    "prominent freckles across nose",
    "distinctive gap between front teeth",
    "slightly asymmetrical smile",
    "thick expressive eyebrows",
    "long elegant neck",
    "distinctive jawline",
    "prominent cheekbones",
    "small beauty mark near mouth",
    "subtle cleft in chin",
    "unusually long eyelashes",
    "slightly pointed ears",
    "distinctive laugh lines",
    "small mole on forehead"
  ];

  /**
   * Generate a comprehensive canonical character description
   */
  public generateCanonicalDescription(
    existingBio?: string, 
    preferredEthnicity?: string,
    roleContext?: string
  ): CanonicalCharacterDescription {
    
    // Select ethnicity (diversified selection)
    const ethnicities = Object.keys(this.ethnicityTemplates);
    const ethnicity = preferredEthnicity && ethnicities.includes(preferredEthnicity) 
      ? preferredEthnicity 
      : this.randomChoice(ethnicities);
    
    const ethnicityData = this.ethnicityTemplates[ethnicity as keyof typeof this.ethnicityTemplates];
    
    // Generate detailed physical traits
    const traits: PhysicalTraits = {
      ethnicity,
      skinTone: this.randomChoice(ethnicityData.skinTones),
      age: this.randomChoice(Object.keys(this.ageDescriptors)),
      bodyType: this.randomChoice(Object.keys(this.bodyTypes)),
      height: this.generateHeight(),
      build: this.bodyTypes[this.randomChoice(Object.keys(this.bodyTypes)) as keyof typeof this.bodyTypes],
      hairType: this.randomChoice(ethnicityData.hairTypes),
      hairColor: this.randomChoice(ethnicityData.commonHairColors),
      hairStyle: this.generateHairStyle(),
      eyeColor: this.generateEyeColor(ethnicity),
      eyeShape: this.randomChoice(ethnicityData.eyeShapes),
      facialStructure: this.randomChoice(ethnicityData.facialStructures),
      distinctiveFeatures: this.selectDistinctiveFeatures(),
      clothingStyle: this.randomChoice(Object.keys(this.clothingStyles)),
      colorPalette: this.generateColorPalette()
    };

    return this.buildCanonicalDescription(traits, existingBio, roleContext);
  }

  private buildCanonicalDescription(
    traits: PhysicalTraits, 
    existingBio?: string, 
    roleContext?: string
  ): CanonicalCharacterDescription {
    
    const ageData = this.ageDescriptors[traits.age as keyof typeof this.ageDescriptors];
    const clothingDescription = this.clothingStyles[traits.clothingStyle as keyof typeof this.clothingStyles];
    
    // Build comprehensive visual descriptor
    const visualDescriptors = `${traits.ethnicity} character, ${ageData.ageRange}, ${traits.skinTone}. ${traits.height} with ${traits.build}. ${traits.hairColor} ${traits.hairType} hair styled in ${traits.hairStyle}. ${traits.eyeColor} ${traits.eyeShape} eyes. ${traits.facialStructure}. ${ageData.facialFeatures}. ${traits.distinctiveFeatures.join(", ")}. Dressed in ${clothingDescription}. Overall appearance: confident and distinctive.`;
    
    // Build immutable traits that must stay consistent
    const alwaysTraits = `IMMUTABLE TRAITS - NEVER CHANGE: ${traits.ethnicity} ethnicity, ${traits.skinTone}, ${traits.eyeColor} eyes, ${traits.hairColor} hair, ${traits.height}, ${traits.facialStructure}, ${traits.distinctiveFeatures.join(", ")}. Character signature colors: ${traits.colorPalette.join(", ")}.`;
    
    // Build negative constraints
    const neverTraits = this.generateNeverTraits(traits);
    
    // Build color scheme
    const colorScheme = `Primary: ${traits.colorPalette[0]}, Secondary: ${traits.colorPalette[1]}, Accent: ${traits.colorPalette[2]}`;

    console.log(`🎨 Generated canonical description for ${traits.ethnicity} character with ${traits.skinTone}`);
    
    return {
      visualDescriptors,
      alwaysTraits,
      neverTraits,
      colorScheme
    };
  }

  private generateNeverTraits(traits: PhysicalTraits): string {
    // Generate opposite traits that this character should never have
    const oppositeEthnicities = Object.keys(this.ethnicityTemplates)
      .filter(e => e !== traits.ethnicity)
      .slice(0, 2);
    
    const oppositeSkinTones = this.getOppositeSkinTones(traits.skinTone);
    const oppositeEyeColors = this.getOppositeEyeColors(traits.eyeColor);
    const oppositeHairColors = this.getOppositeHairColors(traits.hairColor);
    
    return `NEVER HAVE: ${oppositeEthnicities.join(" or ")} features, ${oppositeSkinTones.join(" or ")} skin, ${oppositeEyeColors.join(" or ")} eyes, ${oppositeHairColors.join(" or ")} hair. Never change height category or core facial structure.`;
  }

  private getOppositeSkinTones(currentSkinTone: string): string[] {
    if (currentSkinTone.includes("very light") || currentSkinTone.includes("Type I")) {
      return ["deep undertone (Type V)", "very deep undertone (Type VI)"];
    } else if (currentSkinTone.includes("deep") || currentSkinTone.includes("Type V")) {
      return ["very light (Type I)", "light neutral (Type II)"];
    } else {
      return ["very light (Type I)", "very deep undertone (Type VI)"];
    }
  }

  private getOppositeEyeColors(currentEyeColor: string): string[] {
    const lightEyes = ["blue", "green", "hazel", "light brown"];
    const darkEyes = ["dark brown", "black", "deep brown"];
    
    return currentEyeColor.includes("blue") || currentEyeColor.includes("green") 
      ? darkEyes 
      : lightEyes;
  }

  private getOppositeHairColors(currentHairColor: string): string[] {
    const lightHair = ["blonde", "light brown", "strawberry blonde"];
    const darkHair = ["jet black", "dark brown", "black"];
    
    return currentHairColor.includes("blonde") || currentHairColor.includes("light")
      ? darkHair
      : lightHair;
  }

  private generateHeight(): string {
    const heights = [
      "petite (5'0\"-5'3\")",
      "average height (5'4\"-5'7\")", 
      "tall (5'8\"-6'0\")",
      "very tall (6'1\"+)"
    ];
    return this.randomChoice(heights);
  }

  private generateHairStyle(): string {
    const styles = [
      "shoulder-length layers",
      "short pixie cut", 
      "long and straight",
      "curly and voluminous",
      "sleek bob",
      "tousled and natural",
      "braided updo",
      "messy bun",
      "side-swept bangs",
      "textured crop",
      "flowing waves",
      "neat ponytail"
    ];
    return this.randomChoice(styles);
  }

  private generateEyeColor(ethnicity: string): string {
    const eyeColorsByEthnicity = {
      "East Asian": ["dark brown", "black", "deep brown"],
      "South Asian": ["dark brown", "deep brown", "black", "hazel"],
      "Middle Eastern": ["dark brown", "hazel", "deep brown", "green"],
      "African": ["dark brown", "black", "deep brown"],
      "European": ["blue", "green", "hazel", "brown", "gray"],
      "Nordic": ["blue", "gray", "green", "light brown"],
      "Latino": ["brown", "hazel", "dark brown", "green"],
      "Slavic": ["blue", "green", "gray", "hazel", "brown"]
    };
    
    const colors = eyeColorsByEthnicity[ethnicity as keyof typeof eyeColorsByEthnicity] || ["brown"];
    return this.randomChoice(colors);
  }

  private selectDistinctiveFeatures(): string[] {
    // Select 1-2 distinctive features randomly
    const count = Math.random() > 0.6 ? 2 : 1;
    const shuffled = [...this.distinctiveFeatures].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private generateColorPalette(): string[] {
    const palettes = [
      ["deep navy", "cream", "gold"],
      ["forest green", "tan", "burgundy"],
      ["charcoal gray", "white", "silver"],
      ["burgundy", "ivory", "bronze"],
      ["teal", "beige", "copper"],
      ["plum", "pearl", "rose gold"],
      ["chocolate brown", "cream", "amber"],
      ["midnight blue", "silver", "sapphire"],
      ["emerald", "ivory", "gold"],
      ["wine red", "champagne", "platinum"]
    ];
    return this.randomChoice(palettes);
  }

  /**
   * Generate multiple diverse character descriptions for a batch
   */
  public generateDiverseCharactersBatch(
    count: number,
    existingCharacters: Array<{ ethnicity?: string; role?: string; }> = []
  ): CanonicalCharacterDescription[] {
    const descriptions: CanonicalCharacterDescription[] = [];
    const usedEthnicities = existingCharacters.map(c => c.ethnicity).filter(Boolean);
    const availableEthnicities = Object.keys(this.ethnicityTemplates)
      .filter(e => !usedEthnicities.includes(e));
    
    for (let i = 0; i < count; i++) {
      // Ensure diversity by cycling through unused ethnicities first
      const preferredEthnicity = availableEthnicities[i % availableEthnicities.length];
      descriptions.push(this.generateCanonicalDescription(undefined, preferredEthnicity));
    }
    
    return descriptions;
  }

  /**
   * Utility function to pick random element from array
   */
  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// Export singleton instance
export const characterDescriptorService = new CharacterDescriptorService();