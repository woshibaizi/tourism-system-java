const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'sql', 'data.sql');
const content = fs.readFileSync(dataPath, 'utf-8');

function parseValues(valuesStr) {
  const result = [];
  let i = 0;
  while (i < valuesStr.length) {
    while (i < valuesStr.length && valuesStr[i] === ' ') i++;
    if (i >= valuesStr.length || valuesStr[i] === ')') break;

    if (valuesStr[i] === "'") {
      i++;
      let str = '';
      while (i < valuesStr.length) {
        if (valuesStr[i] === "'") {
          if (i + 1 < valuesStr.length && valuesStr[i + 1] === "'") {
            str += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          str += valuesStr[i];
          i++;
        }
      }
      result.push(str);
    } else {
      let num = '';
      while (i < valuesStr.length && valuesStr[i] !== ',' && valuesStr[i] !== ')' && valuesStr[i] !== ' ') {
        num += valuesStr[i];
        i++;
      }
      result.push(num === 'NULL' ? null : parseFloat(num));
    }
    while (i < valuesStr.length && valuesStr[i] !== ',' && valuesStr[i] !== ')') i++;
    if (i < valuesStr.length && valuesStr[i] === ',') i++;
  }
  return result;
}

const columnOrder = ['id', 'name', 'type', 'keywords', 'features', 'rating', 'ratingCount', 'clickCount',
  'lat', 'lng', 'address', 'openTime', 'image', 'description', 'detailDescription', 'deleted'];

const places = [];
const insertRegex = /INSERT INTO `spot_place` \(.*?\) VALUES \((.+)\);/g;
let match;
while ((match = insertRegex.exec(content)) !== null) {
  const vals = parseValues(match[1]);
  const place = {};
  columnOrder.forEach((col, i) => {
    if (col === 'keywords' || col === 'features') {
      place[col] = typeof vals[i] === 'string' ? JSON.parse(vals[i]) : [];
    } else {
      place[col] = vals[i];
    }
  });
  places.push(place);
}

console.log(`Parsed ${places.length} places`);

function getCity(address) {
  if (!address) return '';
  const m = address.match(/^(.+?市)/);
  if (m) return m[1];
  const m2 = address.match(/^(.+?[省区])/);
  if (m2) return m2[1];
  return address.split(/[ 　]/)[0] || '';
}

function getRegion(address) {
  if (!address) return '';
  const m = address.match(/^(.+?[省市])/);
  return m ? m[1] : '';
}

// Generic words to filter out
const genericCampus = new Set(['大学', '教育', '校园', '综合', '研究', '历史', '学术', '创新',
  '科技', '工程', '文理', '理工', '国际化', '多学科', '技术', '科学', '管理', '国际', '文化',
  '工学', '理学', '师范', '医药', '农业', '林业', '财经', '政法', '民族']);

const genericScenic = new Set(['景区', '风景', '旅游', '观光', '游览', '景点', '历史', '文化',
  '中国', '建筑', '自然', '公园', '风光']);

function pick(arr, max) {
  return arr.slice(0, Math.min(max, arr.length));
}

function generateCampus(p) {
  const { name, keywords, features, address, openTime } = p;
  const region = getRegion(address);
  const city = getCity(address) || region;
  const allTags = [...new Set([...keywords, ...features])];
  const dist = allTags.filter(t => !genericCampus.has(t));
  const openDesc = (openTime && openTime.includes('参观'))
    ? openTime.replace('校园参观时间：', '参观时间').replace('（需预约）', '，需提前预约')
    : '参观需提前预约';

  const seed = parseInt(p.id.replace('place_', '')) || 1;
  const top2 = pick(dist, 2);

  // P1
  let p1;
  if (seed % 3 === 0) {
    p1 = `${name}坐落于${address}，是一所${top2.length > 0 ? '以' + top2.join('、') + '为特色' : '学科门类齐全'}的高等学府，在${city || '国内'}享有卓越声誉。`;
  } else if (seed % 3 === 1) {
    p1 = `${name}位于${city || region || '国内'}，是${top2.length > 0 ? '以' + top2.join('和') + '见长' : '实力雄厚的'}知名学府，备受学子与家长青睐。`;
  } else {
    p1 = `${name}是${city || region || '我国'}一所${top2.length > 0 ? '以' + top2.join('与') + '闻名' : '实力雄厚'}的高校，被誉为相关领域的人才摇篮。`;
  }

  // P2
  const s2Tags = pick(dist.slice(2), 3);
  let p2;
  if (s2Tags.length >= 2) {
    p2 = `学校在${s2Tags.join('、')}等领域持续深耕，形成了鲜明的办学特色。师资力量雄厚，科研平台先进，为国家和社会培养了大批栋梁之材。`;
  } else if (s2Tags.length === 1) {
    p2 = `学校在${s2Tags[0]}方面积淀深厚，拥有一流的教学科研条件。校园文化丰富多彩，为学生成长提供了广阔舞台。`;
  } else {
    p2 = `学校注重学科交叉融合与拔尖创新人才培养，拥有先进的教学设施和雄厚的师资力量，科研成果丰硕。`;
  }

  // P3
  let p3;
  if (seed % 2 === 0) {
    p3 = `校园环境优美，绿树成荫，现代化的教学楼宇与自然景观相得益彰，是求学治学的理想之地。${openDesc}，欢迎前来感受这里的独特魅力。`;
  } else {
    p3 = `漫步校园，可以感受到浓厚的学术氛围与人文气息。${openDesc}，无论您是考生、家长还是游客，这里都值得驻足一游。`;
  }

  return [p1, p2, p3].join('\n\n');
}

function generateScenic(p) {
  const { name, keywords, features, address, openTime } = p;
  const region = getRegion(address);
  const city = getCity(address) || region;
  const allTags = [...new Set([...keywords, ...features])];
  const dist = allTags.filter(t => !genericScenic.has(t));
  const openDesc = (openTime && openTime.includes('开放'))
    ? openTime.replace('景区开放时间：', '开放时间').replace('（需预约）', '，需提前预约')
    : (openTime || '开放时间请以景区公告为准');

  const seed = parseInt(p.id.replace('place_', '')) || 1;
  const top2 = pick(dist, 2);

  // P1: Overview
  let p1;
  if (seed % 3 === 0) {
    p1 = `${name}坐落于${address}，是${city || '当地'}${top2.length > 0 ? '以' + top2.join('、') + '著称' : '闻名遐迩'}的旅游胜地，每年吸引无数游客前来观光游览。`;
  } else if (seed % 3 === 1) {
    p1 = `${name}位于${city || '风景秀丽的'}${region || ''}，是一处${top2.length > 0 ? '集' + top2.join('、') + '于一体' : '独具魅力'}的著名景区，深受游人喜爱。`;
  } else {
    p1 = `${name}是${city || region || '国内'}${top2.length > 0 ? '以' + top2.join('与') + '闻名' : '极具人气'}的景点，以其独特的自然与人文景观吸引着八方来客。`;
  }

  // P2: Highlights
  const s2Tags = pick(dist.slice(2), 3);
  let p2;
  if (s2Tags.length >= 2) {
    const t = s2Tags.slice(0, 2);
    p2 = `景区内${t.join('、')}等景观令人叹为观止，${s2Tags.length > 2 ? s2Tags[2] + '更是' : ''}为游客带来了丰富的视觉与文化体验。漫步其间，处处皆景，步步成画。`;
  } else if (s2Tags.length === 1) {
    p2 = `这里的${s2Tags[0]}景观独具特色，让人流连忘返。景区内设施完善，游览线路清晰，适合不同年龄段的游客前来体验。`;
  } else {
    p2 = `景区将自然风光与人文底蕴完美融合，步移景异，四季皆有不同的韵味。完善的配套设施和便捷的交通让游览体验更加舒适惬意。`;
  }

  // P3: Visitor info
  let p3;
  if (seed % 2 === 0) {
    p3 = `${openDesc}。无论您是历史文化爱好者，还是自然风光追寻者，${name}都能为您带来一段难忘的旅程。`;
  } else {
    p3 = `游览之余，不妨细细品味这里的历史底蕴与文化韵味。${openDesc}，建议预留充足时间，慢慢感受每一处风景背后的故事。`;
  }

  return [p1, p2, p3].join('\n\n');
}

function generateDescription(place) {
  if (place.type === '景区') {
    return generateScenic(place);
  }
  return generateCampus(place);
}

// Generate output files
let enrichSql = 'SET NAMES utf8mb4;\nUSE tourism_db;\n\n';
let dataSql = fs.readFileSync(dataPath, 'utf-8');

let campusCount = 0, scenicCount = 0;

for (const place of places) {
  const desc = generateDescription(place).replace(/'/g, "''");
  enrichSql += `UPDATE spot_place SET detail_description = '${desc}' WHERE id = '${place.id}';\n`;

  // Update data.sql inline
  const escaped = desc.replace(/'/g, "''");
  const idPattern = `'${place.id}'`;
  const escapedId = idPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  dataSql = dataSql.replace(
    new RegExp(`(INSERT INTO \`spot_place\` \\([^)]+\\) VALUES \\('${escapedId}',[^)]*?)(',NULL,0\\)|','[^']*',0\\))`, ''),
    (match, prefix) => `${prefix}','${escaped}',0)`
  );

  if (place.type === '景区') scenicCount++;
  else campusCount++;
}

// Write enrichment migration
const enrichPath = path.join(__dirname, '..', 'sql', 'migration_enrich_descriptions.sql');
fs.writeFileSync(enrichPath, enrichSql, 'utf-8');
console.log(`Generated ${places.length} UPDATE statements → migration_enrich_descriptions.sql`);
console.log(`  Campus: ${campusCount}, Scenic: ${scenicCount}`);

// Rebuild data.sql INSERTs
let sqlLines = dataSql.split(/\r?\n/);
const newSqlLines = [];
let inPlace = false;
for (const line of sqlLines) {
  if (line.includes("INSERT INTO `spot_place`")) {
    inPlace = true;
    // Extract id and find the generated description
    const idMatch = line.match(/place_\d+/);
    if (idMatch) {
      const place = places.find(p => p.id === idMatch[0]);
      if (place) {
        const desc = generateDescription(place).replace(/'/g, "''");
        newSqlLines.push(line.replace(/',NULL,0\);$/, `','${desc}',0);`));
        continue;
      }
    }
    newSqlLines.push(line);
  } else {
    if (inPlace && line.trim() === '') inPlace = false;
    newSqlLines.push(line);
  }
}

fs.writeFileSync(dataPath, newSqlLines.join('\n'), 'utf-8');
console.log('Updated data.sql with corrected descriptions');
