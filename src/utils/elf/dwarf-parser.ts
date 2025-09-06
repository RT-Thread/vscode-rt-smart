import * as fs from 'fs';

interface DwarfLineInfo {
  address: number;
  file: string;
  line: number;
  column: number;
}

interface DwarfCompilationUnit {
  offset: number;
  length: number;
  version: number;
  abbrevOffset: number;
  addressSize: number;
}

export class DwarfParser {
  private buffer: Buffer;
  private debugLineSection?: Buffer;
  private debugInfoSection?: Buffer;
  private debugStrSection?: Buffer;
  private debugAbbrevSection?: Buffer;
  private lineInfoMap: Map<number, DwarfLineInfo> = new Map();
  private fileNames: string[] = [];

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  public setDebugSections(sections: {
    debugLine?: Buffer;
    debugInfo?: Buffer;
    debugStr?: Buffer;
    debugAbbrev?: Buffer;
  }) {
    this.debugLineSection = sections.debugLine;
    this.debugInfoSection = sections.debugInfo;
    this.debugStrSection = sections.debugStr;
    this.debugAbbrevSection = sections.debugAbbrev;
    
    if (this.debugLineSection) {
      this.parseDebugLine();
    }
  }

  private parseDebugLine(): void {
    if (!this.debugLineSection) return;
    
    let offset = 0;
    const section = this.debugLineSection;
    
    while (offset < section.length) {
      const unitStart = offset;
      
      // Read unit length (4 bytes for 32-bit, 12 bytes for 64-bit DWARF)
      let unitLength = section.readUInt32LE(offset);
      offset += 4;
      
      let is64Bit = false;
      if (unitLength === 0xffffffff) {
        // 64-bit DWARF format
        is64Bit = true;
        unitLength = Number(section.readBigUInt64LE(offset));
        offset += 8;
      }
      
      if (unitLength === 0 || offset + unitLength > section.length) {
        break;
      }
      
      const unitEnd = offset + unitLength;
      
      // Read DWARF version
      const version = section.readUInt16LE(offset);
      offset += 2;
      
      if (version < 2 || version > 5) {
        offset = unitEnd;
        continue;
      }
      
      // Read header length
      let headerLength: number;
      if (is64Bit) {
        headerLength = Number(section.readBigUInt64LE(offset));
        offset += 8;
      } else {
        headerLength = section.readUInt32LE(offset);
        offset += 4;
      }
      
      const headerStart = offset;
      
      // Read minimum instruction length
      const minInstrLength = section.readUInt8(offset);
      offset += 1;
      
      // Maximum operations per instruction (DWARF 4+)
      let maxOpsPerInstr = 1;
      if (version >= 4) {
        maxOpsPerInstr = section.readUInt8(offset);
        offset += 1;
      }
      
      // Default is_stmt
      const defaultIsStmt = section.readUInt8(offset);
      offset += 1;
      
      // Line base
      const lineBase = section.readInt8(offset);
      offset += 1;
      
      // Line range
      const lineRange = section.readUInt8(offset);
      offset += 1;
      
      // Opcode base
      const opcodeBase = section.readUInt8(offset);
      offset += 1;
      
      // Standard opcode lengths
      const opcodeLengths: number[] = [];
      for (let i = 1; i < opcodeBase; i++) {
        opcodeLengths[i] = section.readUInt8(offset);
        offset += 1;
      }
      
      // Read directory table
      const directories: string[] = [''];
      if (version <= 4) {
        while (offset < section.length && section[offset] !== 0) {
          const dir = this.readNullTerminatedString(section, offset);
          directories.push(dir.str);
          offset = dir.offset;
        }
        offset++; // Skip null terminator
      }
      
      // Read file name table
      this.fileNames = [''];
      if (version <= 4) {
        while (offset < section.length && section[offset] !== 0) {
          const fileName = this.readNullTerminatedString(section, offset);
          offset = fileName.offset;
          
          const dirIndex = this.readULEB128(section, offset);
          offset = dirIndex.offset;
          
          const modTime = this.readULEB128(section, offset);
          offset = modTime.offset;
          
          const fileSize = this.readULEB128(section, offset);
          offset = fileSize.offset;
          
          const fullPath = dirIndex.value > 0 && dirIndex.value < directories.length
            ? `${directories[dirIndex.value]}/${fileName.str}`
            : fileName.str;
          
          this.fileNames.push(fullPath);
        }
        offset++; // Skip null terminator
      }
      
      // Skip to start of line number program
      offset = headerStart + headerLength;
      
      // Parse line number program
      this.parseLineNumberProgram(section, offset, unitEnd, minInstrLength, lineBase, lineRange, opcodeBase, opcodeLengths);
      
      offset = unitEnd;
    }
  }

  private parseLineNumberProgram(
    section: Buffer,
    startOffset: number,
    endOffset: number,
    minInstrLength: number,
    lineBase: number,
    lineRange: number,
    opcodeBase: number,
    opcodeLengths: number[]
  ): void {
    let offset = startOffset;
    
    // Line number program state machine registers
    let address = 0;
    let fileIndex = 1;
    let line = 1;
    let column = 0;
    let isStmt = false;
    let basicBlock = false;
    let endSequence = false;
    
    while (offset < endOffset) {
      const opcode = section.readUInt8(offset);
      offset += 1;
      
      if (opcode === 0) {
        // Extended opcode
        const length = this.readULEB128(section, offset);
        offset = length.offset;
        
        const extOpcode = section.readUInt8(offset);
        offset += 1;
        
        switch (extOpcode) {
          case 1: // DW_LNE_end_sequence
            endSequence = true;
            if (fileIndex > 0 && fileIndex < this.fileNames.length) {
              this.lineInfoMap.set(address, {
                address,
                file: this.fileNames[fileIndex],
                line,
                column
              });
            }
            // Reset state machine
            address = 0;
            fileIndex = 1;
            line = 1;
            column = 0;
            isStmt = false;
            basicBlock = false;
            endSequence = false;
            break;
            
          case 2: // DW_LNE_set_address
            address = section.readUInt32LE(offset);
            offset += 4;
            break;
            
          case 3: // DW_LNE_define_file
            // Skip for now
            offset += length.value - 1;
            break;
            
          default:
            // Unknown extended opcode, skip
            offset += length.value - 1;
            break;
        }
      } else if (opcode < opcodeBase) {
        // Standard opcode
        switch (opcode) {
          case 1: // DW_LNS_copy
            if (fileIndex > 0 && fileIndex < this.fileNames.length) {
              this.lineInfoMap.set(address, {
                address,
                file: this.fileNames[fileIndex],
                line,
                column
              });
            }
            basicBlock = false;
            break;
            
          case 2: // DW_LNS_advance_pc
            const pcAdvance = this.readULEB128(section, offset);
            offset = pcAdvance.offset;
            address += pcAdvance.value * minInstrLength;
            break;
            
          case 3: // DW_LNS_advance_line
            const lineAdvance = this.readSLEB128(section, offset);
            offset = lineAdvance.offset;
            line += lineAdvance.value;
            break;
            
          case 4: // DW_LNS_set_file
            const file = this.readULEB128(section, offset);
            offset = file.offset;
            fileIndex = file.value;
            break;
            
          case 5: // DW_LNS_set_column
            const col = this.readULEB128(section, offset);
            offset = col.offset;
            column = col.value;
            break;
            
          case 6: // DW_LNS_negate_stmt
            isStmt = !isStmt;
            break;
            
          case 7: // DW_LNS_set_basic_block
            basicBlock = true;
            break;
            
          case 8: // DW_LNS_const_add_pc
            const adjustedOpcode = 255 - opcodeBase;
            const addrIncrement = Math.floor(adjustedOpcode / lineRange) * minInstrLength;
            address += addrIncrement;
            break;
            
          case 9: // DW_LNS_fixed_advance_pc
            const fixedAdvance = section.readUInt16LE(offset);
            offset += 2;
            address += fixedAdvance;
            break;
            
          default:
            // Skip operands for unknown standard opcodes
            if (opcode < opcodeLengths.length) {
              offset += opcodeLengths[opcode];
            }
            break;
        }
      } else {
        // Special opcode
        const adjustedOpcode = opcode - opcodeBase;
        const addrIncrement = Math.floor(adjustedOpcode / lineRange) * minInstrLength;
        const lineIncrement = lineBase + (adjustedOpcode % lineRange);
        
        address += addrIncrement;
        line += lineIncrement;
        
        if (fileIndex > 0 && fileIndex < this.fileNames.length) {
          this.lineInfoMap.set(address, {
            address,
            file: this.fileNames[fileIndex],
            line,
            column
          });
        }
        
        basicBlock = false;
      }
    }
  }

  private readNullTerminatedString(buffer: Buffer, offset: number): { str: string; offset: number } {
    const start = offset;
    while (offset < buffer.length && buffer[offset] !== 0) {
      offset++;
    }
    const str = buffer.toString('utf8', start, offset);
    return { str, offset: offset + 1 };
  }

  private readULEB128(buffer: Buffer, offset: number): { value: number; offset: number } {
    let value = 0;
    let shift = 0;
    let byte: number;
    
    do {
      if (offset >= buffer.length) {
        throw new Error('Buffer overflow reading ULEB128');
      }
      byte = buffer[offset++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    return { value, offset };
  }

  private readSLEB128(buffer: Buffer, offset: number): { value: number; offset: number } {
    let value = 0;
    let shift = 0;
    let byte: number;
    
    do {
      if (offset >= buffer.length) {
        throw new Error('Buffer overflow reading SLEB128');
      }
      byte = buffer[offset++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    // Sign extend
    if (shift < 32 && (byte & 0x40)) {
      value |= -(1 << shift);
    }
    
    return { value, offset };
  }

  public getLineInfo(address: number): DwarfLineInfo | null {
    // Try exact match first
    if (this.lineInfoMap.has(address)) {
      return this.lineInfoMap.get(address) || null;
    }
    
    // Find closest address that is less than or equal to the given address
    let closestInfo: DwarfLineInfo | null = null;
    let closestAddress = -1;
    
    for (const [addr, info] of this.lineInfoMap) {
      if (addr <= address && addr > closestAddress) {
        closestAddress = addr;
        closestInfo = info;
      }
    }
    
    return closestInfo;
  }

  public getAllLineInfo(): Map<number, DwarfLineInfo> {
    return this.lineInfoMap;
  }
}