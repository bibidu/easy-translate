import { createSignal, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { translate } from './utils/translate.ts';

import './index.css';

function isChinese(value) {
  const reg = new RegExp("[\\u4E00-\\u9FFF]+", "g")
  return reg.test(value)
}
const getLanguage = (value) => {
  return isChinese(value) ? { from: 'zh', to: 'en' } : { from: 'en', to: 'zh' }
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
      const { from, to } = getLanguage(value)
      const result = await translate(value, from, to)
      setLoading(false)
      setTransResult(result)
    }, 300)
  }

  const onOuterContainerTap = (event) => {
    // setContainerVisible(false)
  }

  const onResultInputTap = () => {
    const temp = document.body.appendChild(document.createElement('input'))
    temp.style.display = 'none'
    temp.value = resultElement.value
    temp.select()
    document.execCommand('copy')
    setTimeout(() => document.body.removeChild(temp))

    setNotiText('Already copied!')
    setTimeout(() => {
      setNotiText('')
    }, 2000)
  }

  const showWithFocused = () => {
    setContainerVisible(true)
    inputElement?.focus()
  }

  onMount(() => {
    inputElement?.focus()
    document.addEventListener('keydown', (event) => {
      console.log('doc', event)
      const { metaKey, keyCode } = event
      const isPressCommand = metaKey
      const isPressSemicolon = keyCode === 186
      if (isPressCommand && isPressSemicolon) {
        const next = !containerVisible()
        if (next) {
          inputElement?.focus()
        }
        setContainerVisible(next)
      }
    })
  })

  return (
    <>
      <Show when={!containerVisible()}>
        {() => (
          <div
            onClick={showWithFocused}
            class="tp_side-btn"
          >译</div>
        )}
      </Show>
      <Show when={containerVisible()}>
        {() => (
          <div className="layer"></div>
        )}
      </Show>
      <div
        classList={{
          'tp_full-container': true,
          ['tp_container-visible']: containerVisible()
        }}
        onClick={onOuterContainerTap}
      >
        <div class="tp_container" ref={container}>
          {/* <iframe src="https://www.iciba.com" /> */}
          <div
            onClick={onInnerContainerTap}
            class="tp_main-container"
          >
            <div className="tp_title">Translate {isLoading() && '......'}</div>
            <div
              classList={
                {
                  tp_notification: true,
                  ['tp_notification-visible']: Boolean(notiText())
                }
              }>
              {notiText()}
            </div>
            <div className="tp_translate-item">
              <div className="tp_sub-title">Enter</div>
              <textarea
                ref={inputElement}
                onInput={onInputChange}
                class="tp_input-area"
              />
            </div>
            <div className="tp_translate-item">
              <div className="tp_sub-title">Result</div>
              <textarea
                ref={resultElement}
                onClick={onResultInputTap}
                readOnly
                value={transResult()}
                style="font-size:15px;cursor:auto;"
                class="tp_input-area"
              />
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
  root.setAttribute('id', rootId)
  return root
}
const root = document.querySelector(`#${rootId}`) || createRoot()
render(() => <App />, root);
