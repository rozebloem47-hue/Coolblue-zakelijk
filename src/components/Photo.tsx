import type{Photo as PhotoSource}from'@/data/media';
export function Photo({photo,alt,sizes='240px',className='',eager=false}:{photo:PhotoSource;alt:string;sizes?:string;className?:string;eager?:boolean}){return <img className={className} src={photo.src} srcSet={photo.srcSet} sizes={sizes} alt={alt} loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer"/>}
