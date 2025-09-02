import * as fs from 'fs';
import { ElfHeader, SectionHeader, SymbolEntry, Section, Symbol } from './types';

export class ElfParser {
  private buffer: Buffer;
  private elfHeader!: ElfHeader;
  private sectionHeaders: SectionHeader[] = [];
  private stringTable!: Buffer;
  private symbolTable!: Buffer;
  private symbolStringTable!: Buffer;
  private is64Bit: boolean = false;

  constructor(filePath: string) {
    this.buffer = fs.readFileSync(filePath);
    this.parseElfHeader();
    this.parseSectionHeaders();
    this.loadStringTables();
  }

  private parseElfHeader(): void {
    const magic = this.buffer.subarray(0, 4);
    if (magic.toString('hex') !== '7f454c46') {
      throw new Error('Not a valid ELF file');
    }

    this.is64Bit = this.buffer[4] === 2;
    const isLittleEndian = this.buffer[5] === 1;

    if (this.is64Bit) {
      this.elfHeader = {
        magic,
        class: this.buffer[4],
        data: this.buffer[5],
        version: this.buffer[6],
        osabi: this.buffer[7],
        abiversion: this.buffer[8],
        type: this.buffer.readUInt16LE(16),
        machine: this.buffer.readUInt16LE(18),
        entry: this.buffer.readBigUInt64LE(24),
        phoff: this.buffer.readBigUInt64LE(32),
        shoff: this.buffer.readBigUInt64LE(40),
        flags: this.buffer.readUInt32LE(48),
        ehsize: this.buffer.readUInt16LE(52),
        phentsize: this.buffer.readUInt16LE(54),
        phnum: this.buffer.readUInt16LE(56),
        shentsize: this.buffer.readUInt16LE(58),
        shnum: this.buffer.readUInt16LE(60),
        shstrndx: this.buffer.readUInt16LE(62)
      };
    } else {
      this.elfHeader = {
        magic,
        class: this.buffer[4],
        data: this.buffer[5],
        version: this.buffer[6],
        osabi: this.buffer[7],
        abiversion: this.buffer[8],
        type: this.buffer.readUInt16LE(16),
        machine: this.buffer.readUInt16LE(18),
        entry: BigInt(this.buffer.readUInt32LE(24)),
        phoff: BigInt(this.buffer.readUInt32LE(28)),
        shoff: BigInt(this.buffer.readUInt32LE(32)),
        flags: this.buffer.readUInt32LE(36),
        ehsize: this.buffer.readUInt16LE(40),
        phentsize: this.buffer.readUInt16LE(42),
        phnum: this.buffer.readUInt16LE(44),
        shentsize: this.buffer.readUInt16LE(46),
        shnum: this.buffer.readUInt16LE(48),
        shstrndx: this.buffer.readUInt16LE(50)
      };
    }
  }

  private parseSectionHeaders(): void {
    const shoff = Number(this.elfHeader.shoff);
    const shentsize = this.elfHeader.shentsize;
    const shnum = this.elfHeader.shnum;

    for (let i = 0; i < shnum; i++) {
      const offset = shoff + i * shentsize;
      
      if (this.is64Bit) {
        this.sectionHeaders.push({
          name: this.buffer.readUInt32LE(offset),
          type: this.buffer.readUInt32LE(offset + 4),
          flags: this.buffer.readBigUInt64LE(offset + 8),
          addr: this.buffer.readBigUInt64LE(offset + 16),
          offset: this.buffer.readBigUInt64LE(offset + 24),
          size: this.buffer.readBigUInt64LE(offset + 32),
          link: this.buffer.readUInt32LE(offset + 40),
          info: this.buffer.readUInt32LE(offset + 44),
          addralign: this.buffer.readBigUInt64LE(offset + 48),
          entsize: this.buffer.readBigUInt64LE(offset + 56)
        });
      } else {
        this.sectionHeaders.push({
          name: this.buffer.readUInt32LE(offset),
          type: this.buffer.readUInt32LE(offset + 4),
          flags: BigInt(this.buffer.readUInt32LE(offset + 8)),
          addr: BigInt(this.buffer.readUInt32LE(offset + 12)),
          offset: BigInt(this.buffer.readUInt32LE(offset + 16)),
          size: BigInt(this.buffer.readUInt32LE(offset + 20)),
          link: this.buffer.readUInt32LE(offset + 24),
          info: this.buffer.readUInt32LE(offset + 28),
          addralign: BigInt(this.buffer.readUInt32LE(offset + 32)),
          entsize: BigInt(this.buffer.readUInt32LE(offset + 36))
        });
      }
    }
  }

  private loadStringTables(): void {
    // Load section header string table
    const shstrndx = this.elfHeader.shstrndx;
    if (shstrndx < this.sectionHeaders.length) {
      const strTabHeader = this.sectionHeaders[shstrndx];
      const offset = Number(strTabHeader.offset);
      const size = Number(strTabHeader.size);
      this.stringTable = this.buffer.subarray(offset, offset + size);
    }

    // Find and load symbol table and its string table
    for (let i = 0; i < this.sectionHeaders.length; i++) {
      const header = this.sectionHeaders[i];
      if (header.type === 2 || header.type === 11) { // SHT_SYMTAB or SHT_DYNSYM
        const offset = Number(header.offset);
        const size = Number(header.size);
        this.symbolTable = this.buffer.subarray(offset, offset + size);
        
        // Load associated string table
        const strTabIndex = header.link;
        if (strTabIndex < this.sectionHeaders.length) {
          const strTabHeader = this.sectionHeaders[strTabIndex];
          const strOffset = Number(strTabHeader.offset);
          const strSize = Number(strTabHeader.size);
          this.symbolStringTable = this.buffer.subarray(strOffset, strOffset + strSize);
        }
        break;
      }
    }
  }

  private getString(buffer: Buffer, offset: number): string {
    const end = buffer.indexOf(0, offset);
    return buffer.toString('utf8', offset, end);
  }

  private getSectionName(index: number): string {
    if (!this.stringTable) return '';
    return this.getString(this.stringTable, index);
  }

  public getSections(): Section[] {
    const sections: Section[] = [];
    
    for (const header of this.sectionHeaders) {
      const name = this.getSectionName(header.name);
      if (name) {
        sections.push({
          name,
          address: Number(header.addr),
          size: Number(header.size),
          needsLoad: (header.flags & 0x2n) !== 0n // SHF_ALLOC flag
        });
      }
    }
    
    return sections;
  }

  public getAllSymbols(): Symbol[] {
    if (!this.symbolTable || !this.symbolStringTable) {
      return [];
    }

    const symbols: Symbol[] = [];
    const entrySize = this.is64Bit ? 24 : 16;
    const numSymbols = this.symbolTable.length / entrySize;

    for (let i = 0; i < numSymbols; i++) {
      const offset = i * entrySize;
      let entry: SymbolEntry;

      if (this.is64Bit) {
        entry = {
          name: this.symbolTable.readUInt32LE(offset),
          info: this.symbolTable.readUInt8(offset + 4),
          other: this.symbolTable.readUInt8(offset + 5),
          shndx: this.symbolTable.readUInt16LE(offset + 6),
          value: this.symbolTable.readBigUInt64LE(offset + 8),
          size: this.symbolTable.readBigUInt64LE(offset + 16)
        };
      } else {
        entry = {
          name: this.symbolTable.readUInt32LE(offset),
          value: BigInt(this.symbolTable.readUInt32LE(offset + 4)),
          size: BigInt(this.symbolTable.readUInt32LE(offset + 8)),
          info: this.symbolTable.readUInt8(offset + 12),
          other: this.symbolTable.readUInt8(offset + 13),
          shndx: this.symbolTable.readUInt16LE(offset + 14)
        };
      }

      const size = Number(entry.size);
      if (size === 0) continue; // Skip symbols with zero size

      const name = this.getString(this.symbolStringTable, entry.name);
      if (!name) continue;

      const type = this.getSymbolType(entry.info);
      const sectionName = this.getSectionNameByIndex(entry.shndx);

      symbols.push({
        name,
        type,
        address: Number(entry.value),
        size,
        section: sectionName
      });
    }

    return symbols.sort((a, b) => b.size - a.size);
  }

  public getSymbolsBySection(sectionName: string): Symbol[] {
    const allSymbols = this.getAllSymbols();
    return allSymbols
      .filter(sym => sym.section === sectionName)
      .sort((a, b) => b.size - a.size);
  }

  private getSymbolType(info: number): string {
    const type = info & 0xf;
    const typeNames = [
      'NOTYPE', 'OBJECT', 'FUNC', 'SECTION',
      'FILE', 'COMMON', 'TLS', 'NUM'
    ];
    return typeNames[type] || 'UNKNOWN';
  }

  private getSectionNameByIndex(index: number): string {
    if (index === 0 || index >= this.sectionHeaders.length) {
      return '';
    }
    return this.getSectionName(this.sectionHeaders[index].name);
  }
}