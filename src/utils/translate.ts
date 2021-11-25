import { md5 } from "./md5.ts";
import fetch from "fetch-jsonp";

const APPID = "20180427000151021";
const APP_KEY = "erZo2RNV0l6uto96zCQ5";

function createGlobalJSONP(namespace) {
  const script = document.createElement("script");
  script.setAttribute("id", "dxz");

  script.textContent = `function ${namespace}(response) {
    const script = document.querySelector('#dxz')
    script.setAttribute('data-value', JSON.stringify(response))
  }`;
  document.getElementsByTagName("head")[0].appendChild(script);

  return new Promise((resolve) => {
    let time = 0;
    let interval = setInterval(() => {
      const script = document.querySelector("#dxz") as unknown as {
        dataset: { value: string };
      };
      if (time++ > 15) {
        clearInterval(interval);
        return resolve({});
      }
      if (script.dataset.value) {
        clearInterval(interval);
        return resolve(JSON.parse(script.dataset.value));
      }
    }, 200);
  });
}

export async function translate(query = "触发器", from = "zh", to = "en") {
  const salt = new Date().getTime();
  const withAppParams = APPID + query + salt + APP_KEY;
  const sign = md5(withAppParams);

  const requestParams = {
    q: query,
    appid: APPID,
    salt: salt,
    from: from,
    to: to,
    sign: sign,
  };
  console.log("fetch", fetch);
  const params = Object.entries(requestParams)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const namespace = "__jsonp__";

  fetch("https://api.fanyi.baidu.com/api/trans/vip/translate?" + params, {
    jsonpCallbackFunction: namespace,
  });
  const { trans_result: result } = (await createGlobalJSONP(namespace)) as {
    trans_result?: { dst: string }[];
  };
  if (result) {
    return result.map(({ dst }) => dst).join(";\n");
  }

  return "_no result_";
}
