import { CookieStoreOption, MemoryStore, Store } from '@nyoxis/deliberate-sessions'

async function MakeDenoStore(
  storeDriver: string | undefined,
): Promise<Store | CookieStoreOption> {
  let store: Store | CookieStoreOption

  switch (storeDriver) {
    case 'memory':
      store = new MemoryStore()
      break
    case 'cookie':
      store = new CookieStoreOption()
      break
    default:
      store = new MemoryStore()
      break
  }

  return store
}

export default MakeDenoStore