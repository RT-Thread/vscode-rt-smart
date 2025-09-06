export interface Section {
  name: string;
  address: number;
  size: number;
  needsLoad: boolean;
}

export interface Symbol {
  name: string;
  type: string;
  address: number;
  hexaddr: string;
  size: number;
  section?: string;
  object?: string;
}

export interface ElfHeader {
  magic: Buffer;
  class: number;
  data: number;
  version: number;
  osabi: number;
  abiversion: number;
  type: number;
  machine: number;
  entry: bigint;
  phoff: bigint;
  shoff: bigint;
  flags: number;
  ehsize: number;
  phentsize: number;
  phnum: number;
  shentsize: number;
  shnum: number;
  shstrndx: number;
}

export interface SectionHeader {
  name: number;
  type: number;
  flags: bigint;
  addr: bigint;
  offset: bigint;
  size: bigint;
  link: number;
  info: number;
  addralign: bigint;
  entsize: bigint;
}

export interface SymbolEntry {
  name: number;
  info: number;
  other: number;
  shndx: number;
  value: bigint;
  size: bigint;
}