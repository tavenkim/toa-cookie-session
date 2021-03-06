'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

const Toa = require('toa')
const tman = require('tman')
const assert = require('assert')
const request = require('supertest')
const cookieSession = require('..')

function getApp (options) {
  const app = new Toa()
  app.keys = ['abc', 'efg']
  app.use(cookieSession(options))
  return app
}

function FindCookie (name, shouldNot) {
  return function (res) {
    let haveCookie = res.headers['set-cookie']
    haveCookie = haveCookie && haveCookie.some((cookie) => cookie.split('=')[0] === name)
    if (shouldNot !== false) {
      assert.ok(haveCookie, 'should have cookie "' + name + '"')
    } else {
      assert.ok(!haveCookie, 'should not have cookie "' + name + '"')
    }
  }
}

function shouldNotSetCookies () {
  return function (res) {
    assert.strictEqual(res.headers['set-cookie'], undefined, 'should not set cookies')
  }
}

tman.suite('toa-cookie-session', function () {
  tman.it('with options.name', function () {
    const app = getApp({ name: 'hi.session' })
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(200)
  })

  tman.it('default options.signed === true', function () {
    const app = getApp()
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('toa:sess.sig'))
      .expect(200)
  })

  tman.it('when options.signed = false', function () {
    const app = getApp({ name: 'hi.session', signed: false })
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(FindCookie('hi.session.sig', false))
      .expect(200)
  })

  tman.it('when options.secure = true and app is not secured', function () {
    const app = getApp({ secure: true })
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(shouldNotSetCookies())
      .expect(500)
  })

  tman.it('when the session contains a ";"', function * () {
    const app = getApp({ name: 'hi.session' })
    app.use(function () {
      if (this.method === 'POST') {
        this.session.string = ';'
        this.status = 204
      } else {
        this.body = this.session.string
      }
    })

    const server = app.listen()
    const res = yield request(server)
      .post('/')
      .expect(FindCookie('hi.session'))
      .expect(204)

    const cookie = res.headers['set-cookie']
    yield request(server)
      .get('/')
      .set('Cookie', cookie.join(';'))
      .expect(';')
  })

  tman.it('when the session is invalid', function () {
    const app = getApp({ name: 'hi.session', signed: false })
    app.use(function () {
      assert.strictEqual(this.session.isNew, true)
      this.body = ''
    })

    return request(app.listen())
      .get('/')
      .set('Cookie', 'hi.session=invalid_string')
      .expect(200)
  })

  tman.suite('new session', function () {
    let cookie = ''

    tman.it('should not Set-Cookie when not accessed', function () {
      const app = getApp()
      app.use(function () {
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should not Set-Cookie when accessed and not change', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.isNew, true)
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when populated', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.isNew, true)
        this.session.message = 'hello'
        this.body = 'toa'
      })

      const res = yield request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess.sig'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should be the same and not Set-Cookie when accessed and not changed', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'hello')
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when accessed and changed', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'hello')
        this.session.message = 'Hello'
        this.body = 'toa'
      })

      const res = yield request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should Set-Cookie when set new', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'Hello')
        this.session = { name: 'toa' }
        this.body = 'toa'
      })

      const res = yield request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should expire the session when set null', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, undefined)
        assert.strictEqual(this.session.name, 'toa')
        this.session = null
        this.body = JSON.stringify(this.session)
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200, 'null')
    })

    tman.it('should not Set-Cookie when set {}', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(Object.keys(this.session).length, 0)
        this.session = {}
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should create a session when set {name: toa}', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(Object.keys(this.session).length, 0)
        this.session = { name: 'toa' }
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess'))
        .expect(200)
    })

    tman.it('should throw error when set invalid session', function () {
      const app = getApp()
      app.use(function () {
        this.session = 'invalid'
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(500)
    })
  })

  tman.it('should alter the cookie setting', function * () {
    const app = getApp({ maxAge: 3600000, name: 'my.session' })
    app.use(function () {
      if (this.url === '/max') {
        this.sessionOptions.maxAge = 6500000
      }
      this.session.message = 'hello!'
      this.body = 'toa'
    })

    const server = app.listen()
    let res = yield request(server)
      .get('/')
      .expect(200)

    let date = new Date(res.headers.date)
    let expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
    assert.ok(expires - date <= 3600000)

    res = yield request(server)
      .get('/max')
      .expect(200)
    date = new Date(res.headers.date)
    expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
    assert.ok(expires - date >= 5000000)
  })

  tman.it('should not send SameSite=None property on incompatible clients', function * () {
    const app = getApp({ secure: true, sameSite: 'none' })
    app.config.secureCookie = true
    const userAgents = [
      'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML%2C like Gecko) Chrome/64.0.3282.140 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3165.0 Safari/537.36',
      'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-CN; OE106 Build/OPM1.171019.026) AppleWebKit/537.36 (KHTML%2C like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/11.9.4.974 UWS/2.13.2.90 Mobile Safari/537.36 AliApp(DingTalk/4.7.18) com.alibaba.android.rimet/12362010 Channel/1565683214685 language/zh-CN UT4Aplus/0.2.25',
      'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML%2C like Gecko) Chrome/63.0.3239.132 Safari/537.36 dingtalk-win/1.0.0 nw(0.14.7) DingTalk(4.7.19-Release.16) Mojo/1.0.0 Native AppType(release)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML%2C like Gecko) Chrome/62.0.3202.94 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML%2C like Gecko) Chrome/52.0.2723.2 Safari/537.36'
    ]
    app.use(function () {
      this.session.message = 'hello!'
      this.body = 'toa'
    })
    const server = app.listen()
    for (const userAgent of userAgents) {
      const res = yield request(server)
        .get('/')
        .expect(200)
        .set('user-agent', userAgent)
      assert.ok(res.headers['set-cookie'][0].includes('path=/; secure; httponly'))
    }
  })
  tman.it('should send not SameSite=None property on Chrome >= 80', function * () {
    const app = getApp({ secure: true, sameSite: 'none' })
    app.config.secureCookie = true
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3945.29 Safari/537.36'
    app.use(function () {
      this.session.message = 'hello!'
      this.body = 'toa'
    })
    const server = app.listen()
    const res = yield request(server)
      .get('/')
      .set('user-agent', userAgent)
      .expect(200)
    assert.ok(res.headers['set-cookie'][0].includes('path=/; samesite=none; secure; httponly'))
  })
  tman.it('should not send SameSite=none property on non-secure context', function * () {
    const app = getApp({ sameSite: 'none' })
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3945.29 Safari/537.36'
    app.use(function () {
      this.session.message = 'hello!'
      this.body = 'toa'
    })
    const server = app.listen()
    const res = yield request(server)
      .get('/')
      .set('user-agent', userAgent)
      .expect(200)
    assert.ok(res.headers['set-cookie'][0].includes('path=/; httponly'))
  })
})
