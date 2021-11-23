import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import './index.css'

const API_KEY = 'AIzaSyB1KA8ILwBfyQSPqyPA-R8oWVx4j8UV6iY'

const getLanguage = (value) => {
  return /[a-zA-Z\s]+/.test(value) ? {
    source: 'en',
    target: 'zh-CN'
  } : {
      target: 'en',
      source: 'zh-CN'
    }
}

// https://script.google.com/macros/s/AKfycbyhDbCo1ZjaGJ1XT1xQOwoHtW7FE6QDK-LoSDe19K__SW7adBA/exec?text=${encodeURIComponent(value)}&source=en&target=zh-CN
const translate = async (value) => {
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({
        q: value,
        ...getLanguage(value),
      })
    })
    const { data } = await res.json()
    return data.translations[0].translatedText
  } catch (error) {
    return ''
  }
}

const App = () => {
  let container
  let inputElement
  let resultElement
  let translateTimer

  const [isLoading, setLoading] = createSignal(false)
  const [notiText, setNotiText] = createSignal('')
  const [containerVisible, setContainerVisible] = createSignal(false)
  const [transResult, setTransResult] = createSignal('')

  const onCloseButtonTap = () => {
    setContainerVisible(false)
  }

  const onInnerContainerTap = (e) => {
    e.stopPropagation()
  }

  const onInputChange = (event) => {
    const { target: { value } } = event
    if (!value) {
      transResult() && setTransResult('');
      return;
    }

    setLoading(true)
    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const result = await translate(value)
      setLoading(false)
      setTransResult(result)
    }, 300)
  }

  const onOuterContainerTap = () => {
    setContainerVisible(false)
  }

  const onResultInputTap = () => {
    resultElement.select()
    document.execCommand('copy')
    setNotiText('Already copied!')
    setTimeout(() => {
      setNotiText('')
    }, 1000)
  }

  const showWithFocused = () => {
    setContainerVisible(true)
    inputElement.focus()
  }

  onMount(() => {
    inputElement.focus()
    document.addEventListener('keydown', ({ metaKey, keyCode }) => {
      const isPressCommand = metaKey
      const isPressSemicolon = keyCode === 186
      if (isPressCommand && isPressSemicolon) {
        const next = !containerVisible()
        if (next) {
          inputElement.focus()
        }
        setContainerVisible(next)
      }
    })
  })

  return (
    <>
      {!containerVisible() && <div onClick={showWithFocused} class="tp_side-btn">译</div>}
      <div classList={{ 'tp_full-container': true, ['tp_container-visible']: containerVisible() }} onClick={onOuterContainerTap}>
        <div class="tp_container" ref={container}>
          <div onClick={onInnerContainerTap} class="tp_main-container">
            <div className="tp_title">Translate {isLoading() && '......'}</div>
            {notiText() && <div class="tp_notification">{notiText()}</div>}
            <div className="tp_translate-item">
              <div className="tp_sub-title">Enter</div>
              <textarea ref={inputElement} onInput={onInputChange} class="tp_input-area"></textarea>
            </div>
            <div className="tp_translate-item">
              <div className="tp_sub-title">Result</div>
              <textarea ref={resultElement} onClick={onResultInputTap} readOnly value={transResult()} style="font-size:15px;cursor:auto;" class="tp_input-area"></textarea>
            </div>
          </div>
          <div class="tp_close-button" onClick={onCloseButtonTap}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 28 28"
              style="width: 28px;height: 28px;"
            >
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};
const rootId = 'translate-plugin'
const createRoot = () => {
  const root = document.body.appendChild(document.createElement('div'))
  console.log('create', root)
  root.setAttribute('id', rootId)
  return root
}
const root = document.querySelector(`#${rootId}`) || createRoot()
render(() => <App />, root);
