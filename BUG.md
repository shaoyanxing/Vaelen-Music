# Vaelen Music 鈥?闊虫簮 / 鎼滅储 / 鎾斁澶勭悊鏂瑰紡瀵规瘮鍒嗘瀽鎶ュ憡 (BUG.md)

> 瀵规瘮瀵硅薄锛歚lyswhut/lx-music-desktop`锛坢aster锛屾湰娆℃牳瀵瑰埌 `src/renderer/utils/request.js`銆乣musicSdk/**`銆乣src/main/modules/userApi/renderer/preload.js`锛?> 缁撹鍧囩粡杩?*瀹炴祴/澶嶇幇**楠岃瘉锛堣瑙併€屼簩銆佸疄璇佽繃绋嬨€嶏級锛屼笉鏄函闈欐€佺寽娴嬨€?
---

## 涓€銆佺粨璁洪€熻

| # | 闂 | 涓ラ噸搴?| 褰卞搷 | 鐘舵€?|
|---|------|--------|------|------|
| 1 | `src/api.js:18/20` 寮曠敤鏈０鏄庣殑 `fileName` 鈫?ReferenceError 鈫?闊虫簮鍔犺浇鏁翠綋澶辫触 | 馃敶 鑷村懡 | **鎼滅储銆佹挱鏀惧畬鍏ㄤ笉鍙敤**锛?0 涓煶婧愬凡鍔犺浇"锛宍activeSource` 涓虹┖锛宻earch() 鐩存帴 return锛?| 宸插疄娴嬪鐜?|
| 2 | `sources/` 涓や釜鑱氬悎鑴氭湰閲嶅娉ㄥ唽鍚屼竴鎵归煶婧?id锛屽悗鍔犺浇鐨?xinghai 瀹屽叏瑕嗙洊 feichangdao | 馃敶 楂?| 鎾斁 URL 鎴愪负 xinghai 涓汉鍚庣鐨勫崟鐐逛緷璧栵紱feichangdao 鐨勫婧愬洖閫€閾撅紙CHKSZ/婧煶/闀块潚/蹇靛績锛夊舰鍚岃櫄璁?| 浠ｇ爜楠岃瘉 |
| 3 | 鍐呯疆闊充箰婧?SDK 鍙疄鐜颁簡 `search`锛?*娌℃湁浠讳綍 musicUrl/lyric/pic 瀹炵幇** | 馃敶 楂?| 鍐呯疆婧愭挱鏀惧繀椤讳緷璧栫涓夋柟鑴氭湰锛屼笌 lx 鍐呯疆婧愯嚜甯?URL 瀹炵幇瀹屽叏鐩稿弽 | 浠ｇ爜楠岃瘉 |
| 4 | 鏈嶅姟鍣ㄧ runtime 涓庡墠绔?runtime 鐨?action 濂戠害涓嶄竴鑷达紙`musicSearch` vs `search`锛墊 馃煚 楂?| Web/鏈嶅姟鍣ㄦā寮忎笅鑷畾涔夋簮鎼滅储 100% 澶辫触锛堝疄娴嬶細`涓嶆敮鎸佺殑鎿嶄綔: musicSearch`锛?| 宸插疄娴嬪鐜?|
| 5 | Web 妯″紡涓嬪唴缃簮鎼滅储璧版祻瑙堝櫒 `fetch` 鈫?绗笁鏂规帴鍙ｅ叏閮ㄦ棤 CORS 鈫?鍏ㄩ儴澶辫触 | 馃煚 楂?| Web 妯″紡鍐呯疆婧愭悳绱笉鍙敤 | 浠ｇ爜楠岃瘉 |
| 6 | 鎾斁澶辫触瀹屽叏闈欓粯锛氭棤浠讳綍 UI 鎻愮ず锛宍isPlaying` 鐘舵€侀敊璇疆鐪燂紙鏄剧ず 鈴?浣嗘棤澹伴煶锛墊 馃煚 涓?| 鐢ㄦ埛鎰熺煡"鐐逛簡鎾斁娌″弽搴?鍋囨挱鏀? | 浠ｇ爜楠岃瘉 |
| 7 | 鑷畾涔夐煶婧愯繑鍥炵粨鏋滄棤鏍￠獙锛坙x 寮烘牎楠?URL 鏍煎紡/闀垮害/姝岃瘝缁撴瀯锛墊 馃煛 涓?| 鑴氭湰杩斿洖鍨冨溇鍊兼椂 audio src 鏃犳晥涓旀棤鎻愮ず | 浠ｇ爜楠岃瘉 |
| 8 | 鍓嶇 runtime `zlib` 鍏ㄩ儴 reject锛坰erver runtime 鍗存湁瀹屾暣瀹炵幇锛夆啋 涓ゅ娌欑琛屼负涓嶄竴鑷?| 馃煛 涓?| 鐢?zlib 鐨勬簮锛堝閰风嫍姝岃瘝锛夊湪 Tauri/Web 鍓嶇涓嬪け鏁?| 浠ｇ爜楠岃瘉 |
| 9 | Tauri 搴旂敤鍚姩鍗冲穿婧冿紙`exit code: 0xffffffff`锛?| 馃煚 楂?| 鐢ㄦ埛鍙兘閫€鍒?Web 妯″紡锛堣€?Web 妯″紡鍙堟湁 #4/#5锛墊 鏃ュ織璇佹嵁 |
| 10 | 鍏朵綑缁嗚妭 BUG 鑻ュ共锛坘w 闈欓粯绌虹粨鏋溿€亀y 缂?Cookie 澶淬€乵g allPage=1銆佹挱鏀惧弻閲嶈姹傜珵鎬併€乤udio 鏃?@error銆佸悓鍚嶆瓕鏇查珮浜敊璇€佽嚜鍔ㄥ寲娴嬭瘯寮曠敤涓嶅瓨鍦ㄧ殑 qsvip 婧愨€︹€︼級 | 馃煛 浣?| 瑙併€屽叚銆佹瑕侀棶棰樻竻鍗曘€?| 浠ｇ爜楠岃瘉 |

---

## 浜屻€佸疄璇佽繃绋嬶紙澶嶇幇姝ラ涓庣粨鏋滐級

| 鎿嶄綔 | 鍛戒护 | 缁撴灉 |
|------|------|------|
| 浜斾釜鍐呯疆婧愭悳绱紙Node 鐩存帴璋冪敤 SDK锛屾棤娴忚鍣ㄧ幆澧冿級 | `node tests/builtin-search.mjs` | 鉁?鍏ㄩ儴鎴愬姛锛坵y 268 鏉?/ tx 44903 / kw 3305 / kg 480 / mg 126锛夆啋 **璇存槑 SDK 鎼滅储绠楁硶鏈韩娌￠棶棰橈紝闂鍑哄湪鎺ュ叆灞?* |
| 鎾斁 URL锛坸inghai 鍗曠嫭鍔犺浇锛?| `node tests/builtin-play.mjs` | 鉁?xinghai 涓?5 涓钩鍙伴兘杩斿洖浜?URL 鈫?闂涓嶅湪 xinghai 绠楁硶 |
| 鏈嶅姟鍣?runtime 鎼滅储鑷畾涔夋簮 | 鐩存帴璋冪敤 `server/runtime/lx-runtime.cjs` | 鉂?`search(wy)`/`search(qs)` 鍧囨姏 `涓嶆敮鎸佺殑鎿嶄綔: musicSearch`锛坰erver runtime 鏃?action 鍒悕锛?|
| 鍓嶇鎵撳寘浜х墿鐪熷疄杩愯 | `npm run build` + 鏃犲ご Chrome 鍔犺浇 dist | 鉂?**鐘舵€佹爮鏄剧ず "0 涓煶婧愬凡鍔犺浇"**锛屾帶鍒跺彴 `Failed to load sources: ReferenceError: fileName is not defined`锛堜笌 #1 瀹屽叏鍚诲悎锛?|
| Tauri 寮€鍙戣繍琛?| `tauri-dev.log` | 鉂?`error: process didn't exit successfully: target\debug\vaelen-music.exe (exit code: 0xffffffff)` |

> 娉ㄦ剰锛歚tests/automated-test.cjs`銆乣tests/tauri-smoke.mjs` 绛夋祴璇?*缁曡繃浜?`src/api.js` 鐨勫姞杞芥祦绋?*锛堢洿鎺?import LxRuntime / music-sdk锛夛紝鎵€浠ュ畠浠叏閮ㄩ€氳繃锛屽嵈鎺╃洊浜?#1 杩欎釜鑷村懡闂 鈥斺€?娴嬭瘯涓庣湡瀹炲惎鍔ㄨ矾寰勪笉涓€鑷淬€?
---

## 涓夈€佽嚧鍛介棶棰樿瑙?
### 馃敶 #1 闊虫簮鍔犺浇澶辫触锛堟牴鍥狅紝涓€鍒囦笉鍙敤鐨勮捣鐐癸級

`src/api.js`:

```js
13:  const mods = import.meta.glob('../sources/*.js', { query: '?raw', import: 'default', eager: false })
14:  for (const [path, load] of Object.entries(mods)) {
15:    try {
16:      const content = await load()
17:      await runtime.loadSource(content)
18:      console.log('[Source] Loaded: ' + fileName)      // 鈫?fileName 浠庢湭澹版槑锛?19:    } catch (err) {
20:      console.error('[Source] Failed to load ' + fileName + ':', err.message)  // 鈫?鍚屼笂
21:    }
22:  }
```

- `fileName` 鏄?*鏈０鏄庣殑鏍囪瘑绗?*锛宍console.log(... + fileName)` 蹇呯劧鎶?`ReferenceError`锛?- 寮傚父鍙戠敓鍦?`try` 鍐?鈫?琚?`catch` 鎺ヤ綇 鈫?浣?`catch` 閲屽啀娆″紩鐢?`fileName` 鈫?**鍦?catch 鍧椾腑鍐嶆鎶涢敊** 鈫?涓嶅啀琚崟鑾?鈫?`loadBuiltinSources()` 鐩存帴 reject锛屽惊鐜腑鏂紱
- `loadSources()`锛坄src/api.js:26-45`锛夋崟鑾峰悗鍙?console.error锛宍appStore.sources` 淇濇寔 `[]`锛?- `App.vue` 渚ц竟鏍忔樉绀?鏃犲彲鐢ㄩ煶婧?锛宍activeSource` 涓虹┖锛?- `stores/index.js:144` `search()` 寮€澶?`if (!keyword || !activeSource.value) return` 鈫?**鎼滅储鎸夐挳鐐逛簡娌″弽搴?*锛?- 鎾斁鍚岀悊锛氭病鏈変换浣曞彲鐢ㄧ殑 source锛宍api.musicUrl` 璧?`runtime.request` 鈫?`Source not found`銆?
**瀵规瘮 lx-music-desktop**锛氬唴缃?SDK 鐩存帴鍦?renderer 鍏ュ彛 import锛坄musicSdk/index.js`锛夛紝鑷畾涔夋簮閫氳繃鐙珛闅愯棌绐楀彛鎵ц锛坲serApi锛夛紝涓嶅瓨鍦?鍏堝姞杞芥枃浠跺啀娉ㄥ唽"鐨勫姩鎬佸姞杞戒唬鐮佽矾寰勶紝鍥犳涓嶄細鏈夋绫讳綆绾ч敊璇€?
**淇**锛氭妸 `fileName` 鏀逛负 `path`锛堟垨 `path.split('/').pop()`锛夛紱鍚屾椂鎶?catch 閲岀殑 console.error 涔熸敼瀵广€?
---

### 馃敶 #2 涓や釜鑱氬悎鑴氭湰浜掔浉瑕嗙洊锛屾挱鏀惧舰鎴愬崟鐐逛緷璧?
- `src/runtime/lx-runtime.js:233-238`锛歚loadSource` 鐢?`this.sourceInstances.set(key, instance)` 娉ㄥ唽锛?*鍚屼竴 source id 鍚庡姞杞界殑瀹炰緥鐩存帴瑕嗙洊鍓嶈€?*锛?- `src/api.js:13` glob 椤哄簭涓哄瓧姣嶅簭锛歚feichangdao.js` 鈫?`xinghai.js`锛屽洜姝?`wy/tx/kw/kg/mg` 浜斾釜 id 鍏ㄩ儴琚?**xinghai 瑕嗙洊**锛坄sources/getSourceList` 閲屽睍绀虹殑涔熸槸 xinghai 鐨?qualitys锛夛紱
- 缁撴灉锛氭挱鏀?URL 鍏ㄩ儴璧?xinghai 鐨勭湡瀹炲悗绔?`yy.zddyr.top / zrcdy.dpdns.org / music-api.gdstudio.xyz`锛堜釜浜哄弽鍚戜唬鐞嗭級锛宖eichangdao 绮惧績璁捐鐨勫洖閫€閾撅紙CHKSZ 鈫?鏄熸捣 鈫?婧煶 鈫?闀块潚 鈫?蹇靛績锛宍sources/feichangdao.js:243-277`锛?*姘歌繙涓嶄細琚Е鍙?*锛?- 涓€鏃?xinghai 鍚庣闄愭祦/鍋滄湇锛? 涓钩鍙版挱鏀惧叏鎸傦紝涓旀病鏈変换浣?source 鍥為€€銆?
**瀵规瘮 lx-music-desktop**锛?- 鍐呯疆婧愪笌鑷畾涔夋簮**瀹屽叏闅旂**锛堝唴缃浐瀹?5 涓?id锛岃嚜瀹氫箟婧愮粡 `preload.js:28-45` 鐧藉悕鍗曡繃婊?`['kw','kg','tx','wy','mg','local']` + `actions` 杩囨护锛岃剼鏈彧鑳藉０鏄庣櫧鍚嶅崟鍐呯殑 id锛夛紱
- 姣忎釜鑴氭湰鍚勮嚜鐙珛杩愯绐楀彛锛屼笉瀛樺湪 id 瑕嗙洊闂銆?
---

### 馃敶 #3 鍐呯疆婧?SDK 鍙湁鎼滅储锛屾病鏈?URL/姝岃瘝/灏侀潰瀹炵幇

- `src/music-sdk/index.js` 鍙鍑?`builtinSearch`锛涗簲涓?SDK 鏂囦欢锛坵y/tx/kw/kg/mg锛?*娌℃湁涓€涓疄鐜?getMusicUrl**锛?- `src/api.js:108-118` `musicUrl()` 瀵?*鍐呯疆婧愪笉鍋?isBuiltinSource 鍒嗘祦**锛岀洿鎺?`runtime.getMusicUrl` 鈫?璧板埌鑷畾涔夎剼鏈紙xinghai/feichangdao锛夆啋 鎵€浠?*鍐呯疆婧愮殑"姝ｇ‘鎬?瀹屽叏鎶煎湪绗笁鏂硅剼鏈笂**锛?- 涓€鏃︾敤鎴峰垹鎺?鏈兘鍔犺浇 `sources/*.js`锛屾悳绱㈠媺寮鸿繕鑳界敤锛圫DK锛夛紝浣?*鎾斁 100% 涓嶅彲鐢?*銆?
**瀵规瘮 lx-music-desktop**锛氭瘡涓唴缃簮 index 閮芥湁瀹屾暣鑳藉姏瀹炵幇锛?- `wy/index.js:18-27`锛歚getMusicUrl`锛堣蛋 api-source锛夈€乣getLyric`銆乣getPic`銆乣getMusicDetailPageUrl`锛?- `kw/index.js:62-63`銆乣kg/index.js:18-19`銆乣tx/index.js:18-19`銆乣mg/index.js:18-19` 鍚屾牱锛?- 鑷畾涔夋簮鍙湪鍏?*瀹ｇО鏀寔鐨?action**锛坢usicUrl/lyric/pic锛変笂琚皟鐢紝鎼滅储姘歌繙鐢卞唴缃?SDK 瀹屾垚锛坄preload.js:37-45` `supportActions` 閲屾牴鏈病鏈?musicSearch 鐨勪綅缃級銆?
---

### 馃煚 #4 鏈嶅姟鍣?runtime 涓庡墠绔?runtime 濂戠害涓嶄竴鑷达紙Web/鏈嶅姟鍣ㄦā寮忔悳绱㈠叏鎸傦級

鍓嶇 runtime `src/runtime/lx-runtime.js:67`锛?
```js
const ACTION_ALIASES = { musicSearch: ['musicSearch', 'search'] }
```

鍓嶇鍦?`request()` 閲屼細鎶?`musicSearch` 鍒悕鎴愯剼鏈０鏄庣殑 `search`锛坄lx-runtime.js:256-259`锛夈€?
鏈嶅姟鍣?runtime `server/runtime/lx-runtime.cjs:219`锛?
```js
async search(sourceId, keyword, page) { return this.request(sourceId, 'musicSearch', { keyword, page: page || 1 }); }
```

鈫?**鏈嶅姟鍣ㄧ娌℃湁鍒悕澶勭悊**锛岀洿鎺ユ妸 `musicSearch` 浼犵粰 handler锛涜€?`sources/feichangdao.js:308-320` 鍙?`case 'search'`锛寈inghai.js 鏇翠笉澶勭悊浠讳綍鎼滅储 action銆傚疄娴嬬粨鏋滐細

```
[闈炲父鍒€] qs musicSearch 閿欒: 涓嶆敮鎸佺殑鎿嶄綔
[Runtime] Handler error for wy/musicSearch: 涓嶆敮鎸佺殑鎿嶄綔: musicSearch
```

鈫?鍦?`npm run dev:full` / `npm start`锛圵eb+Express 鏈嶅姟鍣級妯″紡涓嬶細**鎵€鏈夎嚜瀹氫箟婧愭悳绱㈠繀鎸?*銆傚彧鏈夊潙 Tauri 鏃讹紙鍓嶇 runtime + Rust 鐩磋繛锛夎繖鏉℃墠纰板阀鑳界敤銆?
鍙﹀ `server/runtime/lx-runtime.cjs:81-83` 鐨?`lxRequest`锛?- **瀹屽叏蹇界暐 `options.form`**锛堝彧澶勭悊 `body`锛屼笖 `req.write(JSON.stringify(body))` 鐩存帴鎶?form 褰?JSON body 鍙戦€併€佹棤 `Content-Type: application/x-www-form-urlencoded`锛夆啋 鐢?form 鐨勬簮锛堢綉鏄?eapi 绛夛級鍦ㄦ湇鍔″櫒妯″紡涓嬭姹傚繀鐒跺け璐ワ紱
- 涓嶆敮鎸?`responseType: 'buffer'` 鐨?base64 琛屼负锛堝墠绔?runtime 鏈熸湜 `res.raw` 涓?base64锛夛紱
- 娌℃湁浠ｇ悊鏀寔銆傚姣?lx 鐨?needle 瀹炵幇锛坄userApi/renderer/preload.js:194-242`锛塮orm/body/formData銆佽秴鏃躲€佸彇娑堝嚱鏁般€佷唬鐞嗗叏閮芥湁銆?
---

### 馃煚 #5 Web 妯″紡鍐呯疆婧愭悳绱?CORS 鍏ㄦ寕

- `src/api.js:93-96`锛氬唴缃簮鎼滅储 鈫?`builtinSearch` 鈫?`src/music-sdk/http.js:55-58` 鈫?闈?Tauri 鏃?`lxRequestViaFetch`锛堟祻瑙堝櫒鍘熺敓 fetch锛夛紱
- `music.163.com`銆乣u.y.qq.com`銆乣search.kuwo.cn`銆乣songsearch.kugou.com`銆乣jadeite.migu.cn` 鍧囦笉杩斿洖 CORS 澶?鈫?**娴忚鍣ㄥ叏閮ㄦ嫤鎴?*锛?- 鍙﹀ `http.js:42` 鎶?`form` 鍙傛暟鎷艰繘 URL query 鑰屼笉鏄?POST body锛坋api 闇€瑕?body `params=...` 鎵嶈兘宸ヤ綔锛夆啋 鍗充娇缁曡繃 CORS 涔熸嬁涓嶅埌鏁版嵁銆?
**瀵规瘮 lx-music-desktop**锛歚src/renderer/utils/request.js` 鐢ㄧ殑鏄?**`needle`锛圢ode HTTP 瀹㈡埛绔級**鈥斺€擡lectron 娓叉煋杩涚▼鑷甫 Node 鑳藉姏锛屾牴鏈病鏈?CORS 姒傚康锛屼篃涓嶉渶瑕佷换浣曚唬鐞嗘湇鍔″櫒銆?
---

### 馃煚 #6 鎾斁澶辫触鍏ㄩ潤榛?+ 鎾斁鐘舵€侀敊涔?
`src/stores/index.js`:

```js
31:  function playSong(index) {
32:    if (index < 0 || index >= playlist.value.length) return
33:    currentIndex.value = index
34:    isPlaying.value = true            // 鈫?URL 杩樻病鍙栧埌灏辩疆鐪?35:    fetchMusicUrl()
36:  }
38:  async function fetchMusicUrl() {
39:    const song = currentSong.value
40:    if (!song) return
41:    try {
42:      const url = await api.musicUrl(song.source || 'wy', song, quality.value)
43:      currentUrl.value = url
44:    } catch (e) {
45:      console.error('Failed to fetch music URL:', e)   // 鈫?鍙湁 console锛屾病鏈変换浣?UI 鍙嶉
46:    }
47:  }
```

- URL 澶辫触 鈫?`currentUrl` 淇濇寔 `''` 鈫?`PlayerBar.vue:160-166` 鐨?watch 涓嶈Е鍙?鈫?audio 鏃?src 鈫?鏃犱换浣曟彁绀猴紱
- `isPlaying` 宸茶缃湡 鈫?鎾斁鎸夐挳鏄剧ず 鈴革紙"鍋囨挱鏀?锛夛紝杩涘害鏉′笉鍔紱
- `PlayerBar.vue:46-56` 鐨?`<audio>` **娌℃湁鐩戝惉 `@error` / `@stalled`**锛孋DN 403/澶辨晥 URL锛堥叿鎴?閰风嫍/QQ 鐩撮摼 5~30 鍒嗛挓鍗冲け鏁堬級瀹屽叏鏃犳劅鐭ワ紱
- `togglePlay()` 鍏?`audioEl.value.play().catch(() => {})`锛坄PlayerBar.vue:117`锛夛紝閿欒琚悶锛?- 鍙岄噸璇锋眰绔炴€侊細`PlayerBar.vue:168-174` watch `currentSong` 閲屽張璋冧竴娆?`fetchMusicUrl()`锛屼笌 `playSong` 閲岀殑璋冪敤骞跺彂锛屾參鐨勮姹傝鐩栧揩鐨勶紙蹇€熷垏姝屾椂鍙挱閿欐瓕/鎾笉鍑猴級銆?
**瀵规瘮 lx-music-desktop**锛?- URL 鍝嶅簲缁?`preload.js:77-103` **寮烘牎楠?*锛堥潪 `https?://` 瀛楃涓层€侀暱搴?>2048 鍗虫嫆鏀跺苟鍥炰紶閿欒 message锛夛紱
- 鎾斁鍣ㄦ湁瀹屾暣鐨?load 澶辫触鐘舵€佹満锛堥敊璇彁绀恒€佽嚜鍔ㄤ笅涓€棣栫瓑锛岃 `src/renderer/core/player/*`锛夈€?
---

### 馃煛 #7 鑷畾涔夋簮缁撴灉鏃犳牎楠?
lx 鍦?`userApi/renderer/preload.js:68-111` 瀵硅剼鏈繑鍥炲仛鐧藉悕鍗曟牎楠岋細
- `musicUrl`锛氬繀椤绘槸 `http(s)://` 瀛楃涓蹭笖 鈮?048 瀛楃锛屽惁鍒?`throw new Error('failed')`锛?- `lyric`锛氭牎楠岀粨鏋勶紙`lyric` 蹇呴』 string 涓?鈮?1200锛宍tlyric/rlyric/lxlyric` 鏈夊悇鑷暱搴︿笂闄愶級锛?- `pic`锛氬悓鏍峰繀椤绘槸 http(s) 瀛楃涓?鈮?048銆?
sonar 鐨?`LxRuntime.request`锛坄src/runtime/lx-runtime.js:251-268`锛?*鍘熸牱閫忎紶**鑴氭湰杩斿洖鐨勪换鎰忓€?鈫?涓€涓啓鍧忕殑鑴氭湰鍙互鐩存帴鎶婇潪 URL 濉炵粰 `<audio>`銆?
---

### 馃煛 #8 鍓嶇娌欑 zlib 缂哄け

`src/runtime/lx-runtime.js:194-199`锛歚zlib.inflate/deflate/inflateRaw/deflateRaw` 鍏ㄩ儴 `reject(new Error('zlib not supported in webview'))`锛涜€?`server/runtime/lx-runtime.cjs:146-151` 鏈夊畬鏁?Node 瀹炵幇銆傚悓涓€浠介煶婧愯剼鏈湪涓や釜杩愯鐜琛屼负涓嶅悓锛堜緥濡傞叿鐙楁瓕璇?鎺ュ彛杩斿洖 deflate 鍘嬬缉鐨勬簮鍦?Web/Tauri 鍓嶇涓嬩細鎸傦級銆?
lx 鐨?preload 鎻愪緵瀹屾暣 zlib锛坄preload.js:298-315`锛夈€?
---

### 馃煚 #9 Tauri 鍚姩鍗冲穿婧?
`tauri-dev.log` 鏈熬锛?
```
Running `target\debug\vaelen-music.exe`
error: process didn't exit successfully: `target\debug\vaelen-music.exe` (exit code: 0xffffffff)
```

- 閫€鍑虹爜 `0xffffffff`锛?1锛夛紝vite 宸插氨缁紝Rust 缂栬瘧宸叉垚鍔?鈫?鐤戜技 WebView2/绐楀彛鍒濆鍖栭樁娈靛穿婧冿紝鎴栬皟璇曟彃浠?`tauri-plugin-log` 鍦?debug 鏉′欢鍒嗘敮锛坄src-tauri/src/lib.rs:7-13`锛夊垵濮嬪寲澶辫触锛?- 璇ユ棩蹇楃洿鎺ュ鑷寸敤鎴峰彧鑳介€€鍥?Web 妯″紡 鈫?Web 妯″紡鍙堣俯 #4/#5 鈫?鏈€缁?鎼滅储銆佹挱鏀句弗閲嶆棤娉曚娇鐢?銆?- 闇€鍦ㄧ洰鏍囨満鍣ㄤ笂杩愯 `cargo tauri dev` 鏌ョ湅 panic 缁嗚妭瀹氫綅锛堟湰鎶ュ憡鏃犳硶杩涗竴姝ヤ笅缁撹锛屾爣璁颁负寰呮煡锛夈€?
---

## 鍥涖€佹瑕侀棶棰樻竻鍗?
| # | 浣嶇疆 | 闂 |
|---|------|------|
| 1 | `src/music-sdk/kw.js:13-15` | 鍝嶅簲瑙ｆ瀽澶辫触锛坆ody 涓?string锛夋椂 `result.TOTAL/SHOW` 涓?undefined 鈫?涓嶆姏閿?鈫?`<result.abslist>` 涓?undefined 鈫?**闈欓粯杩斿洖绌哄垪琛?*锛沴x 姝ゆ椂浼?`retryNum++` 閲嶈瘯锛坄kw/musicSearch.js:102-111`锛?|
| 2 | `src/music-sdk/wy.js:8-18` | eapi 璇锋眰澶翠笉瀹屾暣锛氭棤 `Cookie: os=pc; appver=...`銆乁A 鍥哄畾 Chrome锛坙x 鐢?`wy/utils/index.js:4-13` 鐨勫畬鏁村ご锛夛紝鍙戠増 IP 椋庢帶鏃舵槗 200 浣?code!=200 |
| 3 | `src/music-sdk/mg.js:14` | `allPage: Math.ceil(total / limit) || 1` 鈥斺€?鏃犵粨鏋滄椂 allPage=1 鑰屼笉鏄?0 |
| 4 | `src/music-sdk/tx.js:59-70` | 閲嶈瘯鏃犱紤姝紙>5 娆″嵆澶辫触锛変笖**鏃犻€€閬块棿闅?*锛岀灛鏃惰繛鎵?6 娆℃槗瑙﹀彂 QQ 椋庢帶锛沴x 鍚屾牱鏃犻€€閬匡紙`tx/musicSearch.js:11-68`锛夛紝浣?sonar 鐩存帴鎶涢敊鑰?lx 鏄厛閲嶈瘯 6 娆?|
| 5 | `src/components/PlayerBar.vue:59` | 姝ｅ湪鎾斁鐨勯珮浜敤 `currentSong?.name === song.name` 鍒ゆ柇 鈫?鍚屽悕姝屾洸鍏ㄩ儴楂樹寒 |
| 6 | `src/components/PlayerBar.vue:116-119,128` | `play()` 鐨?Promise 鍏ㄨ catch 鍚炴帀 |
| 7 | `src/utils.js:10-14`锛坄formatPlayTime`锛?| `--/--` 鐗逛緥锛歞uration=0 鐨勬瓕鏇叉椂闀挎樉绀哄紓甯?|
| 8 | `tests/automated-test.cjs` | 寮曠敤涓嶅瓨鍦ㄧ殑 `qsvip` 闊虫簮銆乣data-testid="source-select"` 鏈熸湜鍊间笌鐪熷疄 UI 涓嶇锛堣娴嬭瘯姘歌繙澶辫触锛?|
| 9 | `src/api.js:13` + `sources/*.js` | 涓や釜鑱氬悎鑴氭湰閮借嚜甯︾湡瀹?API key锛坄feichangdao.js:14` 鐨?`oiapi-...` key銆乣xinghai.js` 鐨勪釜浜哄煙鍚嶏級鎵撳寘杩?dist 鈫?婧愮爜/瀵嗛挜娉勯湶椋庨櫓 |
| 10 | Tauri CSP | `connect-src/http/https` 宸叉斁琛屾殏鏃犻棶棰橈紝浣?WebView2 瀹夊叏涓婁笅鏂囦笅 `<audio>` 鎾斁 `http://` 鐨?CDN 鐩撮摼锛坱x/kw/kg 杩斿洖鐨勫叏鏄?http锛夋湁**娣峰悎鍐呭琚嫤鎴闄?*锛岄渶瀹炴祴纭 |
| 11 | `store/index.js:42` | `api.musicUrl(song.source || 'wy', ...)` 纭紪鐮佸厹搴?'wy'锛屼笌褰撳墠閫変腑鐨?`activeSource` 鏃犲叧锛堝鏉ヨ嚜 qs 鍒楄〃鐨勬瓕鏇?source 缂哄け鏃朵細閿欒璇锋眰 'wy'锛?|

---

## 浜斻€丼onar vs lx-music-desktop 澶勭悊鏂瑰紡瀵规瘮琛?
| 缁村害 | lx-music-desktop | vaelen-music |
|------|------------------|-------------|
| 璇锋眰灞?| Electron 娓叉煋杩涚▼ + `needle`锛圢ode 鐩磋繛锛?*鏃?CORS**锛屾敮鎸佷唬鐞?鍙栨秷/瓒呮椂锛塦request.js` | Tauri 妯″紡璧?Rust reqwest锛堝彲鐢級锛沇eb 妯″紡璧版祻瑙堝櫒 fetch锛?*CORS 鍏ㄦ寕**锛夛紱鍙︽湁 Express 鏈嶅姟鍣紙Node锛変絾鍐呯疆婧愭悳绱笉璧板畠 |
| 鍐呯疆婧愯兘鍔?| 姣忎釜婧愮嫭绔嬫ā鍧楋細search/url/lyric/pic/姝屽崟/鐑瘝鍏ㄥ疄鐜?| **鍙湁 search**锛寀rl/lyric 闈犵涓夋柟鑴氭湰 |
| 鑷畾涔夋簮杩愯 | 鐙珛闅愯棌 BrowserWindow + contextBridge锛屽己闅旂 | 涓荤獥鍙?`new Function` 娌欑锛堝媺寮哄彲鐢紝鏃犻殧绂汇€佸彲璇诲叏灞€锛?|
| 鑷畾涔夋簮 action | 鐧藉悕鍗?`musicUrl/lyric/pic`锛坄local` 鍏佽鏇村锛夛紝鏃犳悳绱㈣兘鍔?| 鍏佽鑷畾涔?`search`锛屼絾鍓嶇鏈夊埆鍚嶃€佹湇鍔″櫒鏃犲埆鍚?鈫?**涓ょ琛屼负涓嶄竴鑷?* |
| 鑷畾涔夋簮 id 绠＄悊 | `['kw','kg','tx','wy','mg','local']` 鐧藉悕鍗?+ actions/qualitys 杩囨护锛岃剼鏈棿浜掍笉骞叉壈 | 浠绘剰 id锛?*鍚屽悕 id 鍚庡姞杞借鐩栧墠鍔犺浇** |
| URL 鍝嶅簲鏍￠獙 | 寮烘牎楠岋紙绫诲瀷/闀垮害/鍗忚鍓嶇紑锛夛紝澶辫触鍥炰紶閿欒 | 鏃犳牎楠岋紝鍘熸牱閫忎紶 |
| 鎾斁閿欒澶勭悊 | 瀹屾暣鐘舵€佹満 + 鐢ㄦ埛鍙閿欒鎻愮ず | console.error 鍚庨潤榛橈紝UI 鍋囨挱鏀?|
| zlib/buffer | 瀹屾暣瀹炵幇 | 鍓嶇娌欑 zlib 鍏?reject |
| 娴嬭瘯 | 鑷甫娴嬭瘯浣撶郴 | 娴嬭瘯缁曡繃鐪熷疄鍔犺浇璺緞锛屾帺鐩栬嚧鍛?bug |

---

## 鍏€佷慨澶嶅缓璁紙鎸変紭鍏堢骇锛?
1. **绔嬪嵆**锛氫慨澶?`src/api.js:18/20` 鐨?`fileName` 鈫?`path`锛涘惎鍔ㄥ悗妫€鏌?`sources` 鍒楄〃鑷冲皯 6 椤广€?2. **绔嬪嵆**锛氬惎鍔ㄨ矾寰勫姞鐢ㄦ埛鍙閿欒鎻愮ず锛堥煶婧愬姞杞藉け璐?/ 鎾斁澶辫触 toast锛夛紝绂佹闈欓粯銆?3. **楂?*锛氱粰浜斾釜鍐呯疆婧愬疄鐜?`getMusicUrl/getLyric/getPic`锛堝彲鍙傝€?lx 鐨?`musicSdk/*` 瀹炵幇鎴?`music-sdk` 澧炲姞瀵瑰簲 module锛夛紝璁╂挱鏀句笉渚濊禆绗笁鏂硅剼鏈紱`api.musicUrl` 澧炲姞 `isBuiltinSource` 鍒嗘祦銆?4. **楂?*锛氭秷闄?id 瑕嗙洊 鈥斺€?source 瀹炰緥娉ㄥ唽鏀逛负銆屽悎骞?鎷掔粷閲嶅銆嶏紝鎴栧垹鎺夊叾涓竴涓仛鍚堣剼鏈紱缁?`runtime.getSourceList` 杩斿洖姣忎釜 source 鐨勫綊灞炶剼鏈紙绫讳技 lx 鐨?api-source 姒傚康锛夈€?5. **楂?*锛氱粺涓€鍓嶅悗绔?runtime 濂戠害 鈥斺€?server runtime 琛ラ綈 `ACTION_ALIASES`銆乣form` 鏀寔銆乥uffer base64 琛屼负銆亃lib锛堢洿鎺ュ鐢?`gluegun`/`vm` + Node 鍐呯疆妯″潡锛夈€?6. **涓?*锛歐eb 妯″紡鍐呯疆婧愭悳绱㈡敼璧?`/api/*` 鏈嶅姟鍣ㄤ唬鐞嗭紙vite 宸查厤 proxy锛夛紝褰诲簳缁曞紑 CORS锛沗http.js` 鐨?form 鏀逛负 POST body銆?7. **涓?*锛歚<audio>` 澧炲姞 `@error/@stalled` 澶勭悊锛沠etchMusicUrl 澶辫触鍥炴粴 `isPlaying`锛涘幓鎺?`playSong` 涓?watch 鐨勫弻閲嶈姹傘€?8. **涓?*锛歚PlayerBar.vue:168-174` 涓?store 鐨勮姹傚仛闃叉姈/绔炴€佷护鐗岋紙鍙簲鐢ㄦ渶鍚庝竴娆¤姹傜殑缁撴灉锛夈€?9. **浣?*锛氫慨澶嶇銆屽洓銆嶈妭娓呭崟涓殑鍚勫皬椤癸紱鏇存柊 `tests/automated-test.cjs` 浣垮叾璧扮湡瀹炲惎鍔ㄨ矾寰勶紙鍔犺浇 `src/api.js` 骞舵柇瑷€ `sources.length >= 6`锛夈€?
---

*鐢熸垚鏃堕棿锛?026-08-12 路 渚濇嵁 vaelen-music 鏈湴浠ｇ爜 + lx-music-desktop master 瀹炴祴瀵规瘮*