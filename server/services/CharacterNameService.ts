import { LRUCache } from "lru-cache";

export interface NameDatabase {
  [ethnicity: string]: {
    firstNames: {
      male: string[];
      female: string[];
      neutral: string[];
    };
    lastNames: string[];
  };
}

export interface GeneratedName {
  firstName: string;
  lastName: string;
  fullName: string;
  ethnicity: string;
  gender: string;
}

export class CharacterNameService {
  private usedNameCache = new LRUCache<string, boolean>({ max: 500, ttl: 1000 * 60 * 60 * 24 }); // 24 hour cache
  
  private nameDatabase: NameDatabase = {
    // European/Western
    western: {
      firstNames: {
        male: [
          "Alexander", "Benjamin", "Christopher", "Daniel", "Edward", "Frederick", "Gabriel", "Henry", 
          "Isaac", "Jonathan", "Kenneth", "Lawrence", "Matthew", "Nicholas", "Oliver", "Patrick", 
          "Quentin", "Robert", "Samuel", "Thomas", "Victor", "William", "Xavier", "Zachary", 
          "Adrian", "Marcus", "Vincent", "Sebastian", "Theodore", "Nathaniel", "Dominic", "Raphael"
        ],
        female: [
          "Anastasia", "Beatrice", "Camille", "Delphine", "Eleanor", "Francesca", "Genevieve", "Helena", 
          "Isabella", "Josephine", "Katherine", "Lillian", "Margaret", "Natalie", "Ophelia", "Penelope", 
          "Rosalind", "Sophia", "Teresa", "Veronica", "Winifred", "Ximena", "Yvonne", "Zelda",
          "Cordelia", "Evangeline", "Persephone", "Valentina", "Octavia", "Celeste", "Isadora", "Vivienne"
        ],
        neutral: [
          "Alex", "Cameron", "Dakota", "Emery", "Finley", "Gray", "Harper", "Indigo", "Jordan", "Kit", 
          "Lane", "Morgan", "Peyton", "Onyx", "Rowan", "Casey", "River", "Sage", "Taylor", "Val"
        ]
      },
      lastNames: [
        "Montgomery", "Blackwood", "Sterling", "Ashworth", "Pemberton", "Whitmore", "Lancaster", "Fairfax",
        "Thornfield", "Ravencrest", "Kingsley", "Hawthorne", "Sinclair", "Beaumont", "Cromwell", "Harrington",
        "Westbrook", "Ashford", "Caldwell", "Drummond", "Fitzgerald", "Pembroke", "Rosewood", "Stratford",
        "Aldrich", "Blackthorne", "Chesterton", "Dunmore", "Everingham", "Hartwell", "Lockwood", "Sherwood"
      ]
    },
    
    // East Asian
    eastAsian: {
      firstNames: {
        male: [
          "Akira", "Daichi", "Hiro", "Kenzo", "Ryo", "Takeshi", "Yuki", "Kenji", "Shinji", "Taro", 
          "Wei", "Ming", "Jun", "Chen", "Li", "Zhao", "Yang", "Han", "Jin", "Feng",
          "Joon", "Min", "Hyun", "Seung", "Dong", "Chang", "Sung", "Young", "Ho", "Woo",
          "Hiroshi", "Satoshi", "Masaki", "Ryuji", "Kazuki", "Daisuke", "Tomoya", "Naoki"
        ],
        female: [
          "Akiko", "Emiko", "Haruka", "Keiko", "Miyuki", "Sachiko", "Yuriko", "Asuka", "Chiaki", "Eri",
          "Mei", "Ling", "Xiu", "Yan", "Hui", "Jia", "Ning", "Qing", "Rui", "Shan",
          "Hye", "Ji", "Soo", "Eun", "Na", "Kyung", "Sun", "Mi", "Hee", "Ah",
          "Kumiko", "Noriko", "Reiko", "Tomoko", "Mariko", "Yukiko", "Naoko", "Midori"
        ],
        neutral: [
          "Yuki", "Aki", "Haru", "Nori", "Sato", "Kyo", "Rei", "Taka", "Miki", "Ren"
        ]
      },
      lastNames: [
        "Tanaka", "Yamamoto", "Watanabe", "Kobayashi", "Saito", "Suzuki", "Takahashi", "Ito", "Nakamura", "Kimura",
        "Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Wu", "Zhou", "Xu",
        "Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim",
        "Hayashi", "Matsumoto", "Inoue", "Shimizu", "Yamazaki", "Mori", "Abe", "Ikeda", "Hashimoto", "Yamada"
      ]
    },
    
    // South Asian
    southAsian: {
      firstNames: {
        male: [
          "Aarav", "Arjun", "Dev", "Kiran", "Nikhil", "Raj", "Siddharth", "Vikram", "Aditya", "Dhruv",
          "Rohan", "Samir", "Varun", "Ashwin", "Gautam", "Harsh", "Ishaan", "Kabir", "Madhav", "Naveen",
          "Omar", "Pranav", "Rahul", "Sachin", "Tarun", "Uday", "Vivek", "Yash", "Zain", "Abhishek"
        ],
        female: [
          "Aadhya", "Ananya", "Diya", "Kavya", "Meera", "Priya", "Riya", "Shreya", "Tara", "Veda",
          "Aditi", "Bhavya", "Deepika", "Isha", "Jyoti", "Kiara", "Lakshmi", "Maya", "Nisha", "Pooja",
          "Rashika", "Sanya", "Tanvi", "Uma", "Vidya", "Sunita", "Aisha", "Divya", "Gitika", "Hema"
        ],
        neutral: [
          "Arya", "Dev", "Kiran", "Neel", "Rae", "Sai", "Tanu", "Ved", "Yash", "Zen"
        ]
      },
      lastNames: [
        "Agarwal", "Bansal", "Chandra", "Dutta", "Gupta", "Jain", "Kapoor", "Malhotra", "Nair", "Patel",
        "Reddy", "Sharma", "Tiwari", "Verma", "Yadav", "Singh", "Kumar", "Shah", "Mehta", "Aggarwal",
        "Bhatia", "Chopra", "Desai", "Goel", "Joshi", "Khan", "Lal", "Mishra", "Pandey", "Rao"
      ]
    },
    
    // Middle Eastern/Arabic
    middleEastern: {
      firstNames: {
        male: [
          "Aman", "Badr", "Darius", "Farid", "Hakim", "Idris", "Jamal", "Karim", "Leith", "Malik", 
          "Nasir", "Omar", "Qasim", "Rashid", "Samir", "Tariq", "Umar", "Walid", "Yusuf", "Zaid",
          "Ahmad", "Bilal", "Emir", "Faisal", "Hassan", "Ibrahim", "Khalil", "Marwan", "Nader", "Rami"
        ],
        female: [
          "Amara", "Basma", "Dalia", "Farah", "Hana", "Inaya", "Jannah", "Khadijah", "Layla", "Maryam",
          "Nadia", "Rana", "Samira", "Tala", "Yasmina", "Zara", "Amal", "Bushra", "Esma", "Ghadir",
          "Iman", "Jamila", "Karima", "Leila", "Malika", "Nabila", "Rania", "Safiya", "Tasneem", "Widad"
        ],
        neutral: [
          "Aman", "Farah", "Hakim", "Noor", "Rami", "Samar", "Tariq", "Yasmín", "Zara", "Amara"
        ]
      },
      lastNames: [
        "Al-Rashid", "Al-Zahra", "Bahjat", "Dabbagh", "El-Amin", "Farhat", "Ghazi", "Habib", "Iqbal", "Jawhari",
        "Khoury", "Mansour", "Nassar", "Qureshi", "Rahman", "Salim", "Tahan", "Wahab", "Yassin", "Zaydan",
        "Almasi", "Badawi", "Chalabi", "Darwish", "Farouk", "Hamdan", "Ismail", "Khalifa", "Mubarak", "Nadir"
      ]
    },
    
    // African
    african: {
      firstNames: {
        male: [
          "Amari", "Bakari", "Dalmar", "Ekon", "Femi", "Hasani", "Imamu", "Jengo", "Kesi", "Lateef",
          "Madu", "Nia", "Oba", "Paki", "Runako", "Sekai", "Tano", "Uzoma", "Wasaki", "Yao",
          "Zuberi", "Ajani", "Benni", "Chaka", "Dume", "Enzi", "Folami", "Gamba", "Haji", "Jensi"
        ],
        female: [
          "Abeni", "Binta", "Deka", "Eshe", "Folake", "Habiba", "Imara", "Jamila", "Kefilwe", "Lola",
          "Makena", "Nia", "Oba", "Penda", "Rashida", "Sade", "Tanisha", "Upendo", "Wambui", "Yaa",
          "Zala", "Afia", "Bolade", "Chika", "Diara", "Enolla", "Folami", "Gwyneth", "Hasina", "Ife"
        ],
        neutral: [
          "Asha", "Dara", "Femi", "Kesi", "Nia", "River", "Sekai", "Tano", "Wasaki", "Yaa"
        ]
      },
      lastNames: [
        "Abara", "Bello", "Chukwu", "Diallo", "Ekong", "Fayemi", "Gbenga", "Hassan", "Igwe", "Jalloh",
        "Kone", "Lukaku", "Maina", "Ndidi", "Okafor", "Poku", "Quaye", "Ronke", "Sule", "Taiwo",
        "Uche", "Yakubu", "Zongo", "Adebayo", "Bamidele", "Chioma", "Danjuma", "Emeka", "Funmi", "Gani"
      ]
    },
    
    // Nordic/Scandinavian
    nordic: {
      firstNames: {
        male: [
          "Aksel", "Bjorn", "Casper", "Dag", "Einar", "Finn", "Gustav", "Henrik", "Ivar", "Jakob", 
          "Kai", "Lars", "Magnus", "Nils", "Olaf", "Per", "Ragnar", "Sven", "Torben", "Ulf",
          "Viktor", "Willem", "Axel", "Bjørn", "Erik", "Gunnar", "Håkon", "Ingvar", "Jørgen", "Kristian"
        ],
        female: [
          "Astrid", "Birgit", "Clara", "Dagny", "Erika", "Freya", "Greta", "Hilda", "Ingrid", "Johanna",
          "Karin", "Lena", "Maja", "Nora", "Olga", "Petra", "Runa", "Sigrid", "Thea", "Ulrika",
          "Vera", "Wilma", "Ylva", "Zelda", "Anja", "Berit", "Dorthea", "Elsa", "Frida", "Gunhild"
        ],
        neutral: [
          "Ari", "Bo", "Drew", "Finn", "Kaj", "Linn", "Noor", "Ove", "Rue", "Tove"
        ]
      },
      lastNames: [
        "Andersen", "Berg", "Carlsson", "Dahl", "Eriksson", "Forsberg", "Gustafsson", "Hansen", "Isaksson", "Jensen",
        "Karlsson", "Lindberg", "Magnusson", "Nielsen", "Olsen", "Petersen", "Rasmussen", "Svensson", "Thomsen", "Vang",
        "Wickström", "Åberg", "Øvergård", "Bjørnstad", "Edvardsen", "Haugen", "Kristoffersen", "Larsen", "Myhre", "Nordahl"
      ]
    },
    
    // Latino/Hispanic
    latino: {
      firstNames: {
        male: [
          "Alejandro", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gonzalo", "Hector", "Ignacio", "Jorge",
          "Luis", "Manuel", "Nicolas", "Oscar", "Pablo", "Rafael", "Santiago", "Tomas", "Ulises", "Victor",
          "Xavier", "Yamir", "Zaiden", "Armando", "Benicio", "Cristian", "Damian", "Emilio", "Francisco", "Gerardo"
        ],
        female: [
          "Adriana", "Beatriz", "Carmen", "Daniela", "Elena", "Fernanda", "Gabriela", "Isabella", "Juana", "Karina",
          "Lucia", "Marisol", "Natalia", "Olga", "Patricia", "Raquel", "Sofia", "Teresa", "Valentina", "Ximena",
          "Yanet", "Zara", "Alicia", "Bianca", "Camila", "Esperanza", "Francisca", "Guadalupe", "Hortensia", "Itzel"
        ],
        neutral: [
          "Ale", "Bren", "Cris", "Dani", "Gabi", "Luz", "Mar", "Noe", "Río", "Sol"
        ]
      },
      lastNames: [
        "Alvarez", "Blanco", "Castillo", "Delgado", "Espinoza", "Fernandez", "Garcia", "Hernandez", "Jimenez", "Lopez",
        "Martinez", "Navarro", "Ortega", "Perez", "Ramirez", "Sanchez", "Torres", "Valdez", "Ximenes", "Zavala",
        "Aguilar", "Bautista", "Contreras", "Dominguez", "Escalante", "Fuentes", "Guerrero", "Herrera", "Ibanez", "Juarez"
      ]
    },
    
    // Slavic/Eastern European
    slavic: {
      firstNames: {
        male: [
          "Aleksandr", "Boris", "Dimitri", "Fyodor", "Grigory", "Igor", "Josef", "Konstantin", "Leonid", "Mikhail",
          "Nikita", "Oleg", "Pavel", "Roman", "Sergei", "Timur", "Valentin", "Wassily", "Yevgeny", "Zinovy",
          "Alexei", "Bogdan", "Daniil", "Eduard", "Feliks", "Gennady", "Henryk", "Ivan", "Jakub", "Kirill"
        ],
        female: [
          "Anastasia", "Bogdana", "Darya", "Ekaterina", "Galina", "Irina", "Ksenia", "Lyudmila", "Mariya", "Natalya",
          "Olga", "Polina", "Raisa", "Svetlana", "Tatyana", "Ulyana", "Vera", "Yelena", "Zoya", "Anfisa",
          "Bronislava", "Darinka", "Emiliya", "Feodora", "Hanna", "Isadora", "Jovana", "Kira", "Lada", "Milena"
        ],
        neutral: [
          "Alex", "Bobo", "Dara", "Gene", "Kira", "Luka", "Nika", "Rasa", "Sasha", "Toma"
        ]
      },
      lastNames: [
        "Antonov", "Borisov", "Chernyshev", "Dmitriev", "Egorov", "Fedorov", "Gorbachev", "Ivanov", "Kozlov", "Lebedev",
        "Mikhailov", "Nikolaev", "Orlov", "Petrov", "Romanov", "Smirnov", "Titov", "Vasiliev", "Volkov", "Zakharov",
        "Alexeev", "Belinsky", "Chernov", "Dobrynin", "Ershov", "Frolov", "Grigoriev", "Ilyin", "Kovalev", "Litvinov"
      ]
    }
  };

  /**
   * Generates a unique character name that hasn't been used recently
   */
  public generateUniqueName(preferredEthnicity?: string, preferredGender?: string): GeneratedName {
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const name = this.generateRandomName(preferredEthnicity, preferredGender);
      
      // Check if this name has been used recently
      if (!this.usedNameCache.has(name.fullName.toLowerCase())) {
        // Mark as used and return
        this.usedNameCache.set(name.fullName.toLowerCase(), true);
        console.log(`✨ Generated unique name: ${name.fullName} (${name.ethnicity}, ${name.gender})`);
        return name;
      }
      
      attempts++;
    }

    // If we can't find a unique name after max attempts, generate one anyway but log a warning
    const fallbackName = this.generateRandomName(preferredEthnicity, preferredGender);
    this.usedNameCache.set(fallbackName.fullName.toLowerCase(), true);
    console.warn(`⚠️ Using potentially duplicate name after ${maxAttempts} attempts: ${fallbackName.fullName}`);
    return fallbackName;
  }

  /**
   * Generates a completely random name from all ethnicities
   */
  private generateRandomName(preferredEthnicity?: string, preferredGender?: string): GeneratedName {
    const ethnicities = Object.keys(this.nameDatabase);
    const ethnicity = preferredEthnicity && ethnicities.includes(preferredEthnicity) 
      ? preferredEthnicity 
      : this.randomChoice(ethnicities);
    
    const genders = ['male', 'female', 'neutral'];
    const gender = preferredGender && genders.includes(preferredGender) 
      ? preferredGender 
      : this.randomChoice(genders);
    
    const ethnicityData = this.nameDatabase[ethnicity];
    const firstName = this.randomChoice(ethnicityData.firstNames[gender as keyof typeof ethnicityData.firstNames]);
    const lastName = this.randomChoice(ethnicityData.lastNames);
    
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      ethnicity,
      gender
    };
  }

  /**
   * Clears the recently used names cache (useful for testing or admin functions)
   */
  public clearCache(): void {
    this.usedNameCache.clear();
    console.log("🗑️ Character name cache cleared");
  }

  /**
   * Gets statistics about name usage
   */
  public getUsageStats(): { totalUsed: number; cacheSize: number; ethnicities: string[]; } {
    return {
      totalUsed: this.usedNameCache.size,
      cacheSize: this.usedNameCache.max!,
      ethnicities: Object.keys(this.nameDatabase)
    };
  }

  /**
   * Utility function to pick random element from array
   */
  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generate multiple unique names for a batch (useful for generating multiple characters)
   */
  public generateUniqueNamesBatch(count: number, preferredEthnicity?: string): GeneratedName[] {
    const names: GeneratedName[] = [];
    
    for (let i = 0; i < count; i++) {
      // Alternate genders for diversity
      const gender = i % 3 === 0 ? 'neutral' : i % 2 === 0 ? 'male' : 'female';
      names.push(this.generateUniqueName(preferredEthnicity, gender));
    }
    
    return names;
  }

  /**
   * Check if a specific name is available (not recently used)
   */
  public isNameAvailable(fullName: string): boolean {
    return !this.usedNameCache.has(fullName.toLowerCase());
  }
}

// Export a singleton instance
export const characterNameService = new CharacterNameService();