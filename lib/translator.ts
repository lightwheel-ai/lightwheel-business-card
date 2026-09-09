type Template = 'english' | 'chinese';

type MyMemoryMatch = {
  translation?: string;
};

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseStatus?: number;
  responseDetails?: string;
  matches?: MyMemoryMatch[];
};

const API_URL = 'https://api.mymemory.translated.net/get';
const hanOnly = /^[\p{Script=Han}·]+$/u;
const containsHan = /\p{Script=Han}/u;
const containsLatin = /[A-Za-z]/;

const surnamePinyin: Record<string, string> = {
  张: 'zhang',
  王: 'wang',
  李: 'li',
  赵: 'zhao',
  陈: 'chen',
  刘: 'liu',
  杨: 'yang',
  黄: 'huang',
  周: 'zhou',
  吴: 'wu',
  徐: 'xu',
  孙: 'sun',
  胡: 'hu',
  朱: 'zhu',
  高: 'gao',
  林: 'lin',
  何: 'he',
  郭: 'guo',
  马: 'ma',
  罗: 'luo',
  梁: 'liang',
  宋: 'song',
  郑: 'zheng',
  谢: 'xie',
  韩: 'han',
  唐: 'tang',
  冯: 'feng',
  于: 'yu',
  董: 'dong',
  萧: 'xiao',
  程: 'cheng',
  曹: 'cao',
  袁: 'yuan',
  邓: 'deng',
  许: 'xu',
  傅: 'fu',
  沈: 'shen',
  曾: 'zeng',
  彭: 'peng',
  吕: 'lyu',
  苏: 'su',
  卢: 'lu',
  蒋: 'jiang',
  蔡: 'cai',
  贾: 'jia',
  丁: 'ding',
  魏: 'wei',
  薛: 'xue',
  叶: 'ye',
  欧阳: 'ouyang',
  司马: 'sima',
};

const titleToEnglish: Record<string, string> = {
  市场总监: 'Marketing Director',
  产品总监: 'Product Director',
  销售总监: 'Sales Director',
  设计总监: 'Design Director',
  市场经理: 'Marketing Manager',
  产品经理: 'Product Manager',
  项目经理: 'Project Manager',
  商务拓展经理: 'Business Development Manager',
  总经理: 'General Manager',
  首席执行官: 'Chief Executive Officer',
  首席技术官: 'Chief Technology Officer',
  首席财务官: 'Chief Financial Officer',
  首席运营官: 'Chief Operating Officer',
  创始人: 'Founder',
  联合创始人: 'Co-Founder',
  工程师: 'Engineer',
  设计师: 'Designer',
};

const titleToChinese = Object.fromEntries(
  Object.entries(titleToEnglish).map(([chinese, english]) => [
    english.toLocaleLowerCase(),
    chinese,
  ]),
);

async function requestTranslation(
  text: string,
  from: 'zh-CN' | 'en-GB',
  to: 'zh-CN' | 'en-GB',
  signal?: AbortSignal,
) {
  const url = new URL(API_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${from}|${to}`);

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    signal,
  });
  if (!response.ok) throw new Error('Translation service unavailable.');

  const payload = (await response.json()) as MyMemoryResponse;
  if (payload.responseStatus && payload.responseStatus !== 200) {
    throw new Error(payload.responseDetails || 'Translation failed.');
  }

  const translated = payload.responseData?.translatedText?.trim();
  if (!translated) throw new Error('Translation returned no result.');
  return { translated, matches: payload.matches ?? [] };
}

function westernizeRomanizedName(name: string, sourceName: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.some((part) => containsHan.test(part))) {
    return name.trim();
  }

  const compoundSurname = surnamePinyin[sourceName.slice(0, 2)];
  const expectedSurname = compoundSurname ?? surnamePinyin[sourceName[0]];
  if (expectedSurname) {
    const surnameIndex = parts.findIndex(
      (part) =>
        part.toLocaleLowerCase().replace(/[^a-z]/g, '') === expectedSurname,
    );
    if (surnameIndex === parts.length - 1) return parts.join(' ');
    if (surnameIndex === 0) return [...parts.slice(1), parts[0]].join(' ');
  }

  return [...parts.slice(1), parts[0]].join(' ');
}

function pickChineseNamePart(translated: string, matches: MyMemoryMatch[]) {
  const candidates = [
    translated,
    ...matches.map((match) => match.translation ?? ''),
  ]
    .map((candidate) => candidate.trim())
    .filter((candidate) => hanOnly.test(candidate));

  return candidates.sort((left, right) => {
    const unsuitable = /姐|哥|先生|女士|小姐|夫人|老师|博士|姓/u;
    const leftPenalty = unsuitable.test(left) ? 100 : 0;
    const rightPenalty = unsuitable.test(right) ? 100 : 0;
    return leftPenalty - rightPenalty || left.length - right.length;
  })[0];
}

async function translateEnglishNameToChinese(
  name: string,
  signal?: AbortSignal,
) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';

  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      const result = await requestTranslation(part, 'en-GB', 'zh-CN', signal);
      return pickChineseNamePart(result.translated, result.matches);
    }),
  );

  if (translatedParts.every(Boolean)) {
    const surname = translatedParts.at(-1) ?? '';
    return `${surname}${translatedParts.slice(0, -1).join('')}`;
  }

  const fallback = await requestTranslation(name, 'en-GB', 'zh-CN', signal);
  if (containsHan.test(fallback.translated)) return fallback.translated;
  throw new Error('Unable to translate this name into Chinese.');
}

export async function translateName(
  name: string,
  from: Template,
  to: Template,
  signal?: AbortSignal,
) {
  const source = name.trim();
  if (!source || from === to) return source;

  if (from === 'english') {
    return translateEnglishNameToChinese(source, signal);
  }

  const result = await requestTranslation(source, 'zh-CN', 'en-GB', signal);
  if (!containsLatin.test(result.translated)) {
    throw new Error('Unable to translate this name into English.');
  }
  return westernizeRomanizedName(result.translated, source);
}

export async function translateTitle(
  title: string,
  from: Template,
  to: Template,
  signal?: AbortSignal,
) {
  const source = title.trim();
  if (!source || from === to) return source;

  if (from === 'chinese') {
    return (
      titleToEnglish[source] ??
      (await requestTranslation(source, 'zh-CN', 'en-GB', signal)).translated
    );
  }

  return (
    titleToChinese[source.toLocaleLowerCase()] ??
    (await requestTranslation(source, 'en-GB', 'zh-CN', signal)).translated
  );
}
