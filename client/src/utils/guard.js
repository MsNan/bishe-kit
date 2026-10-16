// 需要登录的页面在这里登记，跳转时自动拦截到登录页
const NEED_LOGIN = ['/pages/mine/profile']
export function setupLoginGuard() {
  for (const api of ['navigateTo', 'redirectTo', 'reLaunch']) {
    uni.addInterceptor(api, {
      invoke(args) {
        const path = args.url.split('?')[0]
        if (NEED_LOGIN.includes(path) && !uni.getStorageSync('token')) {
          uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(args.url) })
          return false
        }
        return args
      },
    })
  }
}
