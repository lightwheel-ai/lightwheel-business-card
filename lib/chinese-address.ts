// Keep each line together so the font positions punctuation after the preceding glyph.
export function chineseAddressRuns(line: string, index: number) {
  const x = 125.8774;
  const y = 123.8422 + index * 13;
  return [{ text: line, x, y }];
}
