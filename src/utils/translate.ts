import { md5 } from "./md5.ts";
import fetch from "fetch-jsonp";

const APPID = "20180427000151021";
const APP_KEY = "erZo2RNV0l6uto96zCQ5";

function createGlobalJSONP(namespace, requestId) {
  const script = document.createElement("script");
  script.setAttribute("id", "_translate_jsonp_");

  script.textContent = `function ${namespace}(response) {
    window.postMessage(
      {
        direction: "from-page-script",
        message: JSON.stringify(response),
      },
      "*"
    );
  }`;
  document.getElementsByTagName("head")[0].appendChild(script);

  return new Promise((resolve) => {
    window.addEventListener("message", (event) => {
      if (
        event.source == window &&
        event.data?.direction == "from-page-script"
      ) {
        resolve({
          requestId,
          body: JSON.parse(event.data.message),
        });
      }
    });
  });
}

let requestId;
function createRequestId() {
  return (requestId = Math.random().toString(36).slice(3));
}
function getRequestId() {
  return requestId;
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
  const params = Object.entries(requestParams)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const namespace = "__jsonp__";

  fetch("https://api.fanyi.baidu.com/api/trans/vip/translate?" + params, {
    jsonpCallbackFunction: namespace,
  });
  const id = createRequestId();
  const {
    requestId,
    body: { trans_result: result },
  } = (await createGlobalJSONP(namespace, id)) as {
    requestId: string;
    body: {
      trans_result?: { dst: string }[];
    };
  };

  if (requestId === getRequestId() && result) {
    return result.map(({ dst }) => dst).join(";\n");
  }

  return "....";
}
