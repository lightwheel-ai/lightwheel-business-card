import assert from 'node:assert/strict';
import {
  parseOcrCard,
  detectCardTemplate,
  pdfTextLines,
} from '../lib/card-ocr-parser.ts';

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
    'Lightwheel\nAmy Tan\nBusiness Development\n+1 (617) 515–7700\namy . tan @ lightwheel . ai',
    'Amy Tan',
    'Business Development',
  ],
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
const jay = parseOcrCard(
  'Lightwheel\nJay Zhao\nSolution Architect\nlinkedin.com/in/jinzhou1\njinzhou.zhao@lightwheel.ai',
);
assert.equal(jay.phone, '');
assert.equal(jay.email, 'jinzhou.zhao@lightwheel.ai');
const contact = parseOcrCard(
  'Amy Tan\nBusiness Development\n+1 (617) 515–7700\namy . tan @ lightwheel . ai',
);
assert.equal(contact.email, 'amy.tan@lightwheel.ai');
assert.equal(contact.phone, '+1 (617) 515-7700');
assert.equal(
  detectCardTemplate('Amy Tan', 'Business Development', '中文.png'),
  'english',
);
assert.equal(detectCardTemplate('陈铭', '市场总监', 'english.png'), 'chinese');
assert.equal(detectCardTemplate('', '', '英文名片.pdf'), 'english');
assert.equal(detectCardTemplate('', '', 'unknown.png'), undefined);
const items = [
  { str: 'Director', transform: [1, 0, 0, 1, 10, 80], width: 40, height: 10 },
  { str: 'Person', transform: [1, 0, 0, 1, 40, 100], width: 30, height: 10 },
  { str: 'Test', transform: [1, 0, 0, 1, 10, 100], width: 25, height: 10 },
];
assert.equal(pdfTextLines(items), 'Test Person\nDirector');
console.log(
  'PASS contact spacing, LinkedIn exclusion, template detection and PDF reading order',
);
