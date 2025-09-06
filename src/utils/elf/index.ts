import { ElfParser } from './elf-parser';
import { MapParser } from './map-parser';
import { Section, Symbol } from './types';

export class ElfAnalyzer {
  private elfParser: ElfParser | null = null;
  private mapParser: MapParser | null = null;

  constructor(elfPath?: string, mapPath?: string) {
    if (elfPath) {
      this.elfParser = new ElfParser(elfPath);
    }
    if (mapPath) {
      this.mapParser = new MapParser(mapPath);
    }
  }

  /**
   * Get all sections from the ELF file
   */
  public getSections(): Section[] {
    if (!this.elfParser) {
      throw new Error('ELF file not loaded');
    }
    return this.elfParser.getSections();
  }

  /**
   * Get symbols by section name
   */
  public getSymbolsBySection(section: string): Symbol[] {
    if (!this.elfParser) {
      throw new Error('ELF file not loaded');
    }
    return this.elfParser.getSymbolsBySection(section);
  }

  /**
   * Get all symbols (merged from ELF and MAP if both available)
   */
  public getAllSymbols(): Symbol[] {
    if (!this.elfParser && !this.mapParser) {
      throw new Error('No ELF or MAP file loaded');
    }

    if (this.elfParser && this.mapParser) {
      const elfSymbols = this.elfParser.getAllSymbols();
      return this.mapParser.mergeWithElfSymbols(elfSymbols);
    } else if (this.elfParser) {
      return this.elfParser.getAllSymbols();
    } else if (this.mapParser) {
      return this.mapParser.getAllSymbols();
    }

    return [];
  }

  /**
   * Get symbols from a specific object file
   */
  public getSymbols(object: string): Symbol[] {
    if (!this.mapParser) {
      // If no MAP file, try to filter by object name from all symbols
      const allSymbols = this.getAllSymbols();
      return allSymbols
        .filter(sym => sym.object === object)
        .sort((a, b) => b.size - a.size);
    }
    return this.mapParser.getSymbolsByObject(object);
  }

  /**
   * Get debug information for a symbol (source file and line number)
   */
  public getSymbolDebugInfo(symbolName: string): { sourceFile?: string; sourceLine?: number } | null {
    if (!this.elfParser) {
      return null;
    }

    try {
      // First find the symbol to get its address
      const allSymbols = this.getAllSymbols();
      const symbol = allSymbols.find(s => s.name === symbolName);
      
      if (!symbol) {
        return null;
      }

      // Use internal DWARF parser to get source file and line number
      const debugInfo = this.elfParser.getSymbolDebugInfo(symbol.address);
      
      if (debugInfo && debugInfo.file) {
        return {
          sourceFile: debugInfo.file,
          sourceLine: debugInfo.line
        };
      }
    } catch (error) {
      console.error('Error getting debug info:', error);
    }
    
    return null;
  }

  /**
   * Get symbol with debug information
   */
  public getSymbolWithDebugInfo(symbolName: string): Symbol | null {
    const allSymbols = this.getAllSymbols();
    const symbol = allSymbols.find(s => s.name === symbolName);
    
    if (!symbol) {
      return null;
    }

    const debugInfo = this.getSymbolDebugInfo(symbolName);
    if (debugInfo) {
      return {
        ...symbol,
        sourceFile: debugInfo.sourceFile,
        sourceLine: debugInfo.sourceLine
      };
    }

    return symbol;
  }
}

// Export types and classes
export { Section, Symbol } from './types';
export { ElfParser } from './elf-parser';
export { MapParser } from './map-parser';