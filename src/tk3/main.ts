// Tapan Kaikki 3: a pocket-sized remake of the classic Finnish top-down shooter, with the
// Lihastohtori body model as its fighters. Entry point of tk3.html.

import './tk3.css'
import { Game } from './game'
import { loadFigure } from './rig'

const container = document.getElementById('tk3')!
const loading = document.createElement('div')
loading.className = 'tk-loading'
loading.textContent = 'Ladataan…'
container.append(loading)

loadFigure(`${import.meta.env.BASE_URL}models/tk3-figure.glb`)
  .then((figure) => {
    loading.remove()
    const game = new Game(container, figure)
    // Dev builds expose the game for poking at it from the console.
    if (import.meta.env.DEV) Object.assign(window, { tk3: game })
  })
  .catch((error: unknown) => {
    loading.textContent = 'Pelin lataus epäonnistui. Päivitä sivu.'
    console.error(error)
  })
