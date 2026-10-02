import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, protectCell, stringifyCsv, unprotectCell } from './csv.js'

describe('parseCsv', () => {
  it('reads plain rows and Windows line endings', () => {
    expect(parseCsv('a,b,c\r\n1,2,3\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('reads quoted cells with commas, doubled quotes and line breaks', () => {
    const text = 'name,notes\n"Smith, J","He said ""hi"""\n"Two\nlines",x'
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Smith, J', 'He said "hi"'],
      ['Two\nlines', 'x'],
    ])
  })

  it('ignores a leading byte order mark', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps empty cells and handles a missing final newline', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ])
  })

  it('detects semicolon and tab separated files', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('detectDelimiter', () => {
  it('ignores separators inside quotes on the first line', () => {
    expect(detectDelimiter('"a;b;c";d,e')).toBe(',')
  })
})

describe('stringifyCsv', () => {
  it('quotes cells that need it and round trips through parseCsv', () => {
    const rows = [
      ['Name', 'Notes'],
      ['Plan, review', 'He said "go"'],
      ['Two\nlines', ' padded '],
    ]
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows)
  })
})

describe('formula protection', () => {
  it('prefixes risky text and reverses cleanly', () => {
    expect(protectCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(protectCell('-note')).toBe("'-note")
    expect(unprotectCell("'=SUM(A1)")).toBe('=SUM(A1)')
  })

  it('leaves ordinary text and plain negative numbers alone', () => {
    expect(protectCell('Build login')).toBe('Build login')
    expect(protectCell('-3')).toBe('-3')
    expect(unprotectCell("'quoted")).toBe("'quoted")
  })
})
