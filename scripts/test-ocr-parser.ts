import assert from 'node:assert/strict';
import { parseOcrCard } from '../lib/card-ocr-parser.ts';

const cases = [
  [
    '4) Lightwheel\nChristopher Jiao\nSolution Architect\n+1 818 233 2603\njiao@lightwheel.ai\n2445 Augustine Dr Santa Clara, CA 95054\nlightwheel.ai',
    'Christopher Jiao',
    'Solution Architect',
  ],
  [
    '40 Lightwheel\nLouis Lian\nProduct Manager\n+33 685169494\nlouis@lightwheel.ai',
    'Louis Lian',
    'Product Manager',
  ],
  [
    '44 Lightwheel\nMing Chen\nSoftware Engineer\nming.chen@lightwheel.ai',
    'Ming Chen',
    'Software Engineer',
  ],
  [
    '光轮智能\n陈 铭\n市场总监\n17621319535\nming.chen@lightwheel.ai\n上海市嘉定区于田大厦3楼',
    '陈铭',
    '市场总监',
  ],
  [
    'Lightwheel\n姓名：张瑞明\n职位：市场总监\n13800008888\nuser@lightwheel.ai',
    '张瑞明',
    '市场总监',
  ],
  ['Lightwheel\n\\ZEAZOSE\nSHEER\nming.chen@lightwheel.ai', '', ''],
  [
    'Lightwheel\nJane Doe\nJohn Smith\nProduct Director',
    '',
    'Product Director',
  ],
];
for (const [text, name, title] of cases) {
  const actual = parseOcrCard(text);
  assert.equal(actual.name, name, text);
  assert.equal(actual.title, title, text);
}
console.log(`PASS ${cases.length} OCR field-assignment cases`);
