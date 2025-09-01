import { ElfAnalyzer, Section, Symbol } from './index';
import * as path from 'path';
import * as fs from 'fs';

describe('ElfAnalyzer', () => {
  let analyzer: ElfAnalyzer;
  const elfPath = path.join(__dirname, '..', 'rtthread.elf');
  const mapPath = path.join(__dirname, '..', 'rtthread.map');

  beforeAll(() => {
    // Skip tests if files don't exist
    if (!fs.existsSync(elfPath) || !fs.existsSync(mapPath)) {
      console.warn('Test files not found. Skipping tests.');
      return;
    }
    analyzer = new ElfAnalyzer(elfPath, mapPath);
  });

  describe('getSections()', () => {
    it('should return an array of sections', () => {
      if (!analyzer) return;
      
      const sections = analyzer.getSections();
      
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should return sections with required properties', () => {
      if (!analyzer) return;
      
      const sections = analyzer.getSections();
      
      sections.forEach(section => {
        expect(section).toHaveProperty('name');
        expect(section).toHaveProperty('address');
        expect(section).toHaveProperty('size');
        expect(section).toHaveProperty('needsLoad');
        
        expect(typeof section.name).toBe('string');
        expect(typeof section.address).toBe('number');
        expect(typeof section.size).toBe('number');
        expect(typeof section.needsLoad).toBe('boolean');
      });
    });

    it('should include common sections like .text', () => {
      if (!analyzer) return;
      
      const sections = analyzer.getSections();
      const sectionNames = sections.map(s => s.name);
      
      expect(sectionNames).toContain('.text');
    });
  });

  describe('getSymbolsBySection()', () => {
    it('should return symbols for a valid section', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getSymbolsBySection('.text');
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
    });

    it('should return symbols with required properties', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getSymbolsBySection('.text');
      
      symbols.forEach(symbol => {
        expect(symbol).toHaveProperty('name');
        expect(symbol).toHaveProperty('type');
        expect(symbol).toHaveProperty('address');
        expect(symbol).toHaveProperty('size');
        
        expect(typeof symbol.name).toBe('string');
        expect(typeof symbol.type).toBe('string');
        expect(typeof symbol.address).toBe('number');
        expect(typeof symbol.size).toBe('number');
      });
    });

    it('should return symbols sorted by size in descending order', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getSymbolsBySection('.text');
      
      for (let i = 1; i < symbols.length; i++) {
        expect(symbols[i].size).toBeLessThanOrEqual(symbols[i-1].size);
      }
    });

    it('should return empty array for non-existent section', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getSymbolsBySection('.nonexistent');
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBe(0);
    });
  });

  describe('getAllSymbols()', () => {
    it('should return an array of all symbols', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getAllSymbols();
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
    });

    it('should not include symbols with zero size', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getAllSymbols();
      
      symbols.forEach(symbol => {
        expect(symbol.size).toBeGreaterThan(0);
      });
    });

    it('should return symbols sorted by size in descending order', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getAllSymbols();
      
      for (let i = 1; i < symbols.length; i++) {
        expect(symbols[i].size).toBeLessThanOrEqual(symbols[i-1].size);
      }
    });

    it('should return symbols with valid addresses', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getAllSymbols();
      
      symbols.forEach(symbol => {
        expect(symbol.address).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(symbol.address)).toBe(true);
      });
    });
  });

  describe('getSymbols()', () => {
    it('should return symbols for a specific object file', () => {
      if (!analyzer) return;
      
      // First get all symbols to find an object file
      const allSymbols = analyzer.getAllSymbols();
      const objectFiles = new Set<string>();
      
      allSymbols.forEach(s => {
        if (s.object) {
          objectFiles.add(s.object);
        }
      });
      
      if (objectFiles.size > 0) {
        const testObject = Array.from(objectFiles)[0];
        const symbols = analyzer.getSymbols(testObject);
        
        expect(Array.isArray(symbols)).toBe(true);
        
        // All returned symbols should belong to the specified object
        symbols.forEach(symbol => {
          expect(symbol.object).toBe(testObject);
        });
      }
    });

    it('should return symbols sorted by size in descending order', () => {
      if (!analyzer) return;
      
      const allSymbols = analyzer.getAllSymbols();
      const objectFiles = new Set<string>();
      
      allSymbols.forEach(s => {
        if (s.object) {
          objectFiles.add(s.object);
        }
      });
      
      if (objectFiles.size > 0) {
        const testObject = Array.from(objectFiles)[0];
        const symbols = analyzer.getSymbols(testObject);
        
        for (let i = 1; i < symbols.length; i++) {
          expect(symbols[i].size).toBeLessThanOrEqual(symbols[i-1].size);
        }
      }
    });

    it('should return empty array for non-existent object', () => {
      if (!analyzer) return;
      
      const symbols = analyzer.getSymbols('nonexistent.o');
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should throw error when accessing getSections without ELF file', () => {
      const noElfAnalyzer = new ElfAnalyzer(undefined, mapPath);
      
      expect(() => {
        noElfAnalyzer.getSections();
      }).toThrow('ELF file not loaded');
    });

    it('should throw error when accessing getSymbolsBySection without ELF file', () => {
      const noElfAnalyzer = new ElfAnalyzer(undefined, mapPath);
      
      expect(() => {
        noElfAnalyzer.getSymbolsBySection('.text');
      }).toThrow('ELF file not loaded');
    });

    it('should throw error when accessing getAllSymbols without any file', () => {
      const emptyAnalyzer = new ElfAnalyzer();
      
      expect(() => {
        emptyAnalyzer.getAllSymbols();
      }).toThrow('No ELF or MAP file loaded');
    });
  });
});