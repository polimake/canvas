/**
 * Cómo se llaman las páginas que nombra el editor.
 *
 * El nombre de una página es DATO: va en el marco y se guarda con el diseño. Por
 * eso aquí se separan dos cosas que antes iban juntas en `pages.ts`:
 *
 *  - PONER nombre (`Página 3`, `Portada (copia)`). Lo decide quien llama, que es
 *    quien tiene las etiquetas del host; sin nada, salen los de serie.
 *  - RECONOCER un nombre de serie para renumerarlo. Eso no depende del idioma en
 *    el que se trabaje ahora, sino de los nombres que ya hay guardados.
 *
 * Sin dependencias a propósito (como `layout.ts`): lo usan `pages.ts` y
 * `paginate.ts`, y se puede importar sin cargar Excalidraw.
 */
/**
 * Los nombres que el editor pone. La forma coincide con la de las etiquetas de
 * página del host (`labels.pages`), así que quien las tiene las pasa tal cual.
 */
export interface PageNames {
    /** Nombre de serie de la página número `n` (1 = la primera). */
    defaultName?: (n: number) => string;
    /** Cómo se nombra una página que no tiene nombre. */
    untitled?: string;
    /** Nombre de la copia al duplicar; recibe el de la original. */
    copyName?: (name: string) => string;
}
/** Los de serie, en español: los que ha puesto siempre el editor. */
export declare const DEFAULT_PAGE_NAMES: Required<PageNames>;
/** Los de quien llama sobre los de serie: lo que falte, o venga vacío, cae al de serie. */
export declare function resolvePageNames(names?: PageNames | null): Required<PageNames>;
/** ¿Es un nombre de serie (`Página 3`, `Page 3`) y no uno puesto a mano? */
export declare function isDefaultPageName(name: string | null | undefined): boolean;
/**
 * El nombre de serie que le toca a una página en la posición `n`, o `null` si
 * el que lleva no es de serie (y entonces no se toca).
 *
 * Conserva la PALABRA que ya tenía: «Página 3» pasa a «Página 2», no a
 * «Page 2», aunque ahora se trabaje en inglés. Renumerar no es traducir: si lo
 * fuera, abrir un diseño en otro idioma le reescribiría los nombres a todas sus
 * páginas, y dos personas con idiomas distintos se los cambiarían la una a la
 * otra en cada guardado.
 */
export declare function renumberedPageName(name: string | null | undefined, n: number): string | null;
//# sourceMappingURL=pageNames.d.ts.map