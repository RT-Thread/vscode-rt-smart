import * as fs from 'fs';
import { Symbol } from './types';

export class MapParser {
  private content: string;
  private symbols: Map<string, Symbol> = new Map();

  constructor(filePath: string) {
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.parse();
  }

  private parse(): void {
    const lines = this.content.split('\n');
    let inSymbolSection = false;
    let currentObject = '';

    for (const line of lines) {
      // Detect symbol section start
      if (line.includes('Symbol') && line.includes('File')) {
        inSymbolSection = true;
        continue;
      }

      if (!inSymbolSection) continue;

      // Parse object file name
      const objectMatch = line.match(/^\..*?\s+0x[0-9a-f]+\s+0x[0-9a-f]+\s+(.+\.o)/i);
      if (objectMatch) {
        currentObject = objectMatch[1];
      }

      // Parse symbol entries
      // Format: symbol_name    0xaddress    0xsize    object_file
      const symbolMatch = line.match(/^\s+(\S+)\s+0x([0-9a-f]+)\s+0x([0-9a-f]+)/i);
      if (symbolMatch) {
        const name = symbolMatch[1];
        const address = parseInt(symbolMatch[2], 16);
        const size = parseInt(symbolMatch[3], 16);

        if (size > 0) { // Only store symbols with non-zero size
          const key = `${name}_${address}`;
          if (!this.symbols.has(key) || this.symbols.get(key)!.size < size) {
            this.symbols.set(key, {
              name,
              type: 'UNKNOWN',
              address,
              hexaddr: '0x' + address.toString(16),
              size,
              object: currentObject || undefined
            });
          }
        }
      }

      // Alternative format handling
      const altMatch = line.match(/^([.\w]+)\s+0x([0-9a-f]+)\s+0x([0-9a-f]+)/i);
      if (altMatch && !symbolMatch) {
        const name = altMatch[1];
        const address = parseInt(altMatch[2], 16);
        const size = parseInt(altMatch[3], 16);

        if (size > 0 && !name.startsWith('.')) {
          const key = `${name}_${address}`;
          if (!this.symbols.has(key) || this.symbols.get(key)!.size < size) {
            this.symbols.set(key, {
              name,
              type: 'UNKNOWN',
              address,
              hexaddr: '0x' + address.toString(16),
              size,
              object: currentObject || undefined
            });
          }
        }
      }
    }
  }

  public getAllSymbols(): Symbol[] {
    return Array.from(this.symbols.values()).sort((a, b) => b.size - a.size);
  }

  public getSymbolsByObject(objectFile: string): Symbol[] {
    return Array.from(this.symbols.values())
      .filter(sym => sym.object === objectFile)
      .sort((a, b) => b.size - a.size);
  }

  public mergeWithElfSymbols(elfSymbols: Symbol[]): Symbol[] {
    const mergedMap = new Map<string, Symbol>();

    // Add ELF symbols first
    for (const sym of elfSymbols) {
      const key = `${sym.name}_${sym.address}`;
      mergedMap.set(key, sym);
    }

    // Merge MAP symbols (may provide additional object info)
    for (const sym of this.symbols.values()) {
      const key = `${sym.name}_${sym.address}`;
      const existing = mergedMap.get(key);
      if (existing) {
        // Merge object information from MAP file
        if (sym.object && !existing.object) {
          existing.object = sym.object;
        }
      } else {
        mergedMap.set(key, sym);
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => b.size - a.size);
  }
}