import { useRef } from 'react'
import sources from './data/sources.json'

// Attribution required by CC BY-SA 4.0 for the 3D model; details in public/models/ATTRIBUTION.md.
function ModelAttribution() {
  return (
    <>
      <p>
        <a href="https://anatomytool.org/node/63936" target="_blank" rel="noreferrer">
          “Open3DModel – Lower limb – English labels”
        </a>{' '}
        by Open3D project, Jan Kooloos, RadboudUMC, Eungyeol Lee, LUMC et al., lisenssi{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
      <p>
        <a href="https://anatomytool.org/content/open3dmodel-upper-limb-english-labels" target="_blank" rel="noreferrer">
          “Open3DModel – Upper limb – English labels”
        </a>{' '}
        by Open3D project, Jan Kooloos, RadboudUMC, Eungyeol Lee, LUMC et al., lisenssi{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
      <p>
        <a
          href="https://anatomytool.org/content/open3dmodel-muscles-thorax-abdomen-and-back-english-labels"
          target="_blank"
          rel="noreferrer"
        >
          “Open3DModel – Muscles of thorax, abdomen and back – English labels”
        </a>{' '}
        by Open3D project, Eungyeol Lee, LUMC, Andreas Herrler, MUMC+ et al., lisenssi{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
      <p>
        Pää ja kaula:{' '}
        <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noreferrer">
          “Z-Anatomy – The libre 3D atlas of anatomy”
        </a>{' '}
        by Gauthier Kervyn, Marcin Zielinski et al., lisenssi{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
      <p>
        Mallit perustuvat{' '}
        <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noreferrer">
          Z-Anatomy
        </a>{' '}
        -malliin (CC BY-SA 4.0) ja{' '}
        <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer">
          BodyParts3D
        </a>
        -malliin (© The Database Center for Life Science).
      </p>
      <p>
        Lihasten kiinnityskohdat:{' '}
        <a
          href="https://anatomytool.org/content/open3dmodel-muscle-attachments-english-labels"
          target="_blank"
          rel="noreferrer"
        >
          “Open3DModel – Muscle attachments – English labels”
        </a>{' '}
        by Open3D project, Eungyeol Lee, LUMC, Jan Kooloos, RadboudUMC et al., lisenssi{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
      <p>
        Muutokset: malleista on otettu mukaan vain raajojen, vartalon, pään ja kaulan lihakset, jänteet ja luut,
        tekstuurit on korvattu yksivärisillä materiaaleilla, vartalon, pään ja kaulan geometriaa on kevennetty,
        pää ja kaula on kohdistettu muihin malleihin ja geometria on pakattu uudelleen.
        Muokatut mallit on lisensoitu CC BY-SA 4.0 -lisenssillä.
      </p>
    </>
  )
}

export function SourcesDialog() {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button type="button" className="sources-button" onClick={() => ref.current?.showModal()}>
        Lähteet ja lisenssit
      </button>
      <dialog ref={ref} className="notice sources" aria-labelledby="sources-title">
        <h2 id="sources-title">Lähteet ja lisenssit</h2>
        <h3>Tietolähteet</h3>
        <ul>
          {sources.map((source) => (
            <li key={source.id}>
              {source.citation}{' '}
              {source.url && (
                <a href={source.url} target="_blank" rel="noreferrer">
                  Avaa lähde
                </a>
              )}
            </li>
          ))}
        </ul>
        <h3>3D-malli</h3>
        <ModelAttribution />
        <h3>Lähdekoodi</h3>
        <p>Lihastohtorin lähdekoodi on MIT-lisensoitu.</p>
        <form method="dialog">
          <button>Sulje</button>
        </form>
      </dialog>
    </>
  )
}
