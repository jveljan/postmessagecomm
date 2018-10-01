let registeredProtocols = {}
export default function (otherWindow, requestHandlers, identifier, logger) {
  if(!logger) {
    logger = emptyLogger()
  }
  if(registeredProtocols[identifier]) {
    logger.warn(`postmessagecomm ${identifier} is already registered. Trying to register it again?`)
    return registeredProtocols[identifier]
  }

  function postMessage(type, obj) {
    const msg = Object.assign({type}, obj)
    msg[identifier] = true
    otherWindow.postMessage(msg, '*')
  }

  let messageListener = undefined
  let callId = 100
  const listeners = []
  const listenerMap = {
    // listeners for reponses
    // empty initially
  }
  messageListener = window.addEventListener('message', (e) => {
    // ignore other messages
    if(!e.data) { return; }
    if (!e.data[identifier]) { return; }
    logger.debug(`Recieved ${identifier} message`, e)
    if (e.data.type === 'request') {
      const method = e.data.method
      const id = e.data.id
      const args = e.data.args
      if (typeof requestHandlers[method] === 'function') {
        const returnValue = args ? requestHandlers[method](...args) : requestHandlers[method]()
        // if returnValue is promise => wait to be resolved before call postMessage
        Promise.resolve(returnValue)
        .then((value) => {
          const resp = {
            id,
            returnValue: value
          }
          logger.debug('Sending response', resp)
          postMessage('response', resp)
        })
      } else {
        logger.warn('no method found', method)
      }
    } else if (e.data.type === 'response') {
      if (listenerMap[e.data.id]) {
        listenerMap[e.data.id](e.data.returnValue)
        delete listenerMap[e.data.id]
      } else {
        logger.warn('No handler for response', e.data)
      }
    } else if (e.data.type === 'event') {
      // calling all listeners
      listeners.map(cb => cb(e.data.event))
    } else {
      logger.warn('Recieved unknown message type', e.data.type, e.data)
    }
  })
  logger.info('Regisrering protocol', identifier, otherWindow, requestHandlers)
  const rv = {
    sendEvent(data) {
      postMessage('event', data)
    },
    onEvent(callback) {
      if (callback && typeof callback === 'function') {
        listeners.push(callback)
      } else {
        logger.warn('passed non function callback in onEvent', callback)
      }
    },
    createCall(method) {
      return function clientCall(...args) {
        const id = callId
        callId += 1
        const req = {
          id,
          method,
          args
        }
        logger.info('Sending request', req)
        postMessage('request', req)
        return new Promise((success) => {
          listenerMap[id] = (data) => {
            success(data)
          }
        })
      }
    },
    destroy() {
      registeredProtocols = {}
      window.removeEventListener('message', messageListener)
    }
  }
  registeredProtocols[identifier] = rv
  return rv
}

function emptyLogger() {
  const emptyFn = () => {}
  return {
    warn: emptyFn,
    info: emptyFn,
    debug: emptyFn,
  }
}