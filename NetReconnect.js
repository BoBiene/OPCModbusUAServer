/**
 * https://github.com/Cloud-Automation/node-net-reconnect
 * Copyright (C) 2017 Stefan Poeter (Stefan.Poeter[at]cloud-automation.de)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */
let debug = require('debug')('net-reconnect')
let NetKeepAlive = require('net-keepalive')

class NetReconnect {

  constructor (socket, options) {
    this._socket = socket
    this._options = options
    this._retryTime = options.retryTime || 1000
    this._retryAlways = options.retryAlways || false
    this._keepAliveDelay = Math.max(options.keepAliveDelay, 1000) || 1000
    this._keepAliveInterval = Math.max(options.keepAliveInterval, 1000) || 1000
    this._keepAliveProbes = Math.max(Math.min(options.keepAliveProbes, 1), 20) || 1
    this._closing = false

    this._socket.on('connect', this._onConnect.bind(this))
    this._socket.on('close', this._onClose.bind(this))
    this._socket.on('error', this._onError.bind(this))
  }

  static apply (socket, options) {
    return new NetReconnect(socket, options)
  }

  _reconnect () {
    debug('reconnecting in %d', this._retryTime)
    setTimeout(function () {
      this._socket.connect(this._options)
    }.bind(this), this._retryTime)
  }

  _onConnect () {
    if (this._closing) {
      return
    }

    this._socket.setKeepAlive(true, this._keepAliveDelay)
    NetKeepAlive.setKeepAliveInterval(this._socket, this._keepAliveInterval)
    NetKeepAlive.setKeepAliveProbes(this._socket, this._keepAliveProbes)

    debug('online')
  }

  _onClose (hadError) {
    if (this._closing) {
      return
    }
    debug('offline')
    this._state = 'offline'
    if (!hadError) {
      debug('connection closed on purpose')
      if (this._retryAlways) {
        debug('retryAlways flag active, reconnecting')
        this._reconnect()
        return
      } else {
        debug('not reconnecting')
        return
      }
    }

    debug('connection closed with errors, reconnecting')

    this._reconnect()
  }

  _onError () {
    if (this._closing) {
      return
    }

    debug('error')
  }

  end () {
    debug('closing socket permanently')
    this._closing = true
    this._socket.removeListener('connect', this._onConnect)
    this._socket.removeListener('close', this._onClose)
    this._socket.removeListener('error', this._onError)
    return this._socket.end.apply(this._socket, arguments)
  }

}

module.exports = NetReconnect