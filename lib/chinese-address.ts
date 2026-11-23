// Illustrator uses a condensed text matrix and individual offsets around the parentheses.
export function chineseAddressRuns(line: string, index: number) {
  const x = 125.8774;
  const y = 123.8422 + index * 12.9999;
  if (index === 0 && line === '北京市海淀区中关村(海淀)具身智能创新产业园B座6层') {
    return [
      { text: '北京市海淀区中关村', x, y },
      { text: '(', x: x + 8.42 * 4.947, y: y + 0.204 },
      { text: '海淀', x: x + 9.354 * 4.947, y },
      { text: ')', x: x + 11.304 * 4.947, y: y + 0.204 },
      { text: '具身智能创新产业园B座6层', x: x + 11.708 * 4.947, y },
    ];
  }
  return [{ text: line, x, y }];
}
