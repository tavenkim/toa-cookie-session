'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

module.exports = toaCookieSession

function toaCookieSession (options) {
  options = options || {}
  options.overwrite = options.overwrite !== false
  options.httpOnly = options.httpOnly !== false
  options.signed = options.signed !== false
  var sessionKey = options.name || 'toa:sess'

  return function cookieSession (done) {
    var session = false
    this.sessionOptions = Object.create(options)

    Object.defineProperty(this, 'session', {
      enumerable: true,
      configurable: false,
      get: function () {
        if (session === false) {
          session = this.cookies.get(sessionKey, this.sessionOptions)
          session = new Session(session && decode(session))
        }
        return session
      },
      set: function (val) {
        if (val == null) session = null
        else if (typeof val === 'object') session = new Session(val)
        else throw new Error('session can only be set as null or an object.')
      }
    })

    this.onPreEnd = function (cb) {
      if (session !== false) {
        this.cookies.set(sessionKey, session == null ? '' : encode(session), this.sessionOptions)
      }
      return cb()
    }
    done()
  }
}

function Session (obj) {
  Object.defineProperty(this, 'isNew', {value: !obj})

  if (obj) {
    Object.keys(obj).map(function (key) {
      this[key] = obj[key]
    }, this)
  }
}

function decode (string) {
  try {
    return JSON.parse(new Buffer(string, 'base64').toString('utf8'))
  } catch (e) {}
}

function encode (body) {
  return new Buffer(JSON.stringify(body)).toString('base64')
}
