export default function (otherWindow, requestHandlers) {
  console.log('Regisrering protocol', otherWindow, requestHandlers)
  function postMessage(type, obj) {
    otherWindow.postMessage(Object.assign({
      webtopcall: true,
      type
    }, obj), '*')
  }

  let callId = 100
  const listeners = []
  const listenerMap = {
    // listeners for reponses
    // empty initially
  }
  window.addEventListener('message', (e) => {
    if (!e.data && !e.data.webtopcall) {
      // ignore other messages
      return
    }
    if (e.data.type === 'request') {
      const method = e.data.method
      const id = e.data.id
      const args = e.data.args
      // TODO: check for method existance...
      if (typeof requestHandlers[method] === 'function') {
        const returnValue = args ? requestHandlers[method](...args) : requestHandlers[method]()
        // if returnValue is promise => wait to be resolved before call postMessage
        Promise.resolve(returnValue)
          .then((value) => {
            const resp = {
              id,
              returnValue: value
            }
            console.log('Sending response', resp)
            postMessage('response', resp)
          })
      } else {
        console.warn('no method found', method)
      }
    } else if (e.data.type === 'response') {
      if (listenerMap[e.data.id]) {
        listenerMap[e.data.id](e.data.returnValue)
        delete listenerMap[e.data.id]
      } else {
        console.warn('No handler for response', e.data)
      }
    } else if (e.data.type === 'editor-event') {
      // calling all listeners
      listeners.map(cb => cb(e.data.event))
    } else {
      console.warn('Recieved unknown message type', e.data.type, e.data)
    }
  })
  return {
    // TODO: unregister
    onEvent(callback) {
      if (callback && typeof callback === 'function') {
        listeners.push(callback)
      } else {
        console.warn('passed non function callback in onEvent', callback)
      }
    },
    createCall(method) {
      return function clientCall(...args) {
        const id = callId
        callId += 1
        postMessage('request', {
          id,
          method,
          args
        })
        return new Promise((success) => {
          listenerMap[id] = (data) => {
            success(data)
          }
        })
      }
    }
  }
}