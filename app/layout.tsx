import type { Metadata } from 'next';
export const metadata:Metadata={title:'MediPencil | 케어 코디네이션',description:'합성 데이터로 의료진과 보호자가 소통하는 케어 플랫폼'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
