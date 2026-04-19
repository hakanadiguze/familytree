'use client'
import { useState, useEffect } from 'react'
import styles from './HelpPanel.module.css'

interface QA {
  q: string
  a: string
}

const DESKTOP_QA: QA[] = [
  {
    q: "Kişi nasıl eklenir?",
    a: "İki yöntem var: (1) Sağ alttaki + butonuna tıklayıp 'Add Person' seçin. (2) Canvas'ta boş bir alana çift tıklayın — tıkladığınız noktada yeni kişi oluşturulur."
  },
  {
    q: "Kişi nasıl düzenlenir?",
    a: "Kişi objesine tıklayın, açılan detay panelinde 'Edit person' butonuna basın. Ad, fotoğraf, doğum tarihi, doğum yeri ve durum (yaşıyor/hayatını kaybetti) bilgilerini güncelleyebilirsiniz."
  },
  {
    q: "Kişi nasıl silinir?",
    a: "Kişiye tıklayın → 'Edit person' → en alttaki kırmızı 'Delete person' butonuna basın. Sadece tree sahibi (owner) kişi silebilir."
  },
  {
    q: "Bağlantı nasıl eklenir?",
    a: "İki yöntem: (1) + butonuna tıklayıp 'Add Connection' seçin. (2) Kişi objesinin sağ tarafında beliren mavi + butonunun üzerine gelip başka bir kişiye sürükleyin."
  },
  {
    q: "Bağlantı nasıl silinir?",
    a: "Kişiye tıklayın → Connections listesinde silmek istediğiniz bağlantının sağındaki × butonuna basın."
  },
  {
    q: "Kişiyi nasıl taşırım?",
    a: "Pan modunda (✋) kişi objesinin sol tarafında beliren ✥ ikonunu tutup sürükleyin. Birden fazla kişiyi taşımak için Select moduna (⬚) geçin, dikdörtgen çizerek seçin ve sürükleyin."
  },
  {
    q: "Fotoğraf nasıl eklenir?",
    a: "Kişiyi düzenlerken Photo alanında URL sekmesine fotoğraf linki yapıştırın, ya da Upload sekmesinden cihazınızdan fotoğraf yükleyin (Cloudinary yapılandırılmışsa)."
  },
  {
    q: ".ged dosyası nasıl yüklenir?",
    a: "Sağ üstteki ··· menüsünden 'Import .ged' seçin ve dosyayı seçin. Kişiler ve bağlantılar otomatik içe aktarılır, hiyerarşik düzende yerleştirilir."
  },
  {
    q: "Düzeni nasıl düzeltirim?",
    a: "Süper admin hesabıyla ··· menüsünden 'Auto re-layout' seçeneğini kullanın. Tüm kişiler nesil hiyerarşisine göre otomatik yerleştirilir."
  },
  {
    q: "Tree'yi paylaşmak nasıl?",
    a: "··· menüsünden 'Copy share link' seçin. Bu link ile herkes ağacı salt okunur olarak görüntüleyebilir, giriş yapmasına gerek yok."
  },
  {
    q: "Co-admin nasıl atanır?",
    a: "⚙️ Settings menüsünden Co-admins bölümüne e-posta adresi girerek ekleyebilirsiniz. Co-adminler kişi ekleyip düzenleyebilir ama silemez."
  },
  {
    q: "PDF olarak nasıl dışa aktarırım?",
    a: "··· menüsünden 'Export PDF' seçin. Ağacın boyutuna göre otomatik A4–A0 arası kağıt seçilir, tek sayfada çıktı alınır."
  },
  {
    q: "Renk sistemi nasıl çalışır?",
    a: "Her anne-baba çiftinin çocukları aynı rengi paylaşır. Bağlantı çizgileri de o ailenin rengiyle gösterilir. Böylece büyük ağaçlarda hangi çocuğun hangi aileye ait olduğu hemen anlaşılır."
  },
  {
    q: "Nesil (Generation) düzeni nasıl çalışır?",
    a: "En eski nesil en üstte, en genç en altta yerleşir. Eşler her zaman aynı nesil satırında gösterilir. Kardeşler ve kuzenler de doğal olarak aynı satıra hizalanır."
  },
]

const MOBILE_QA: QA[] = [
  {
    q: "Kişi nasıl eklenir?",
    a: "Sağ alttaki büyük + butonuna dokunun ve 'Add Person' seçin. Formda ad, fotoğraf, doğum tarihi ve diğer bilgileri doldurup kaydedin."
  },
  {
    q: "Kişi nasıl düzenlenir?",
    a: "Kişi objesine dokunun, açılan bilgi panelinde 'Edit person' butonuna basın."
  },
  {
    q: "Kişi nasıl silinir?",
    a: "Kişiye dokunun → 'Edit person' → en alttaki kırmızı 'Delete person' butonuna basın. Sadece tree sahibi silebilir."
  },
  {
    q: "Bağlantı nasıl eklenir?",
    a: "Kişiye dokunun, açılan panelde '+ Add connection' butonuna basın. Bağlanmak istediğiniz kişiyi ve ilişki tipini seçin."
  },
  {
    q: "Bağlantı nasıl silinir?",
    a: "Kişiye dokunun → Connections listesinde silmek istediğiniz bağlantının sağındaki × butonuna dokunun."
  },
  {
    q: "Kişiyi nasıl taşırım?",
    a: "Kişi objesine dokunup basılı tutun, sonra sürükleyin. Bıraktığınızda yeni konuma taşınır."
  },
  {
    q: "Fotoğraf nasıl eklenir?",
    a: "Kişiyi düzenlerken Photo → Upload sekmesine geçin ve 'Choose from device' ile galerinizden fotoğraf seçin."
  },
  {
    q: "Ekranı nasıl yakınlaştırırım?",
    a: "İki parmakla sıkıştırarak (pinch) zoom yapabilirsiniz. Soldaki + ve − butonlarını da kullanabilirsiniz."
  },
  {
    q: ".ged dosyası nasıl yüklenir?",
    a: "Sağ üstteki ··· menüsünden 'Import .ged' seçin ve dosyayı seçin."
  },
  {
    q: "Tree'yi paylaşmak nasıl?",
    a: "··· menüsünden 'Copy share link' seçin. Bu link ile herkes ağacı salt okunur görüntüleyebilir."
  },
  {
    q: "Renk sistemi nasıl çalışır?",
    a: "Her anne-baba çiftinin çocukları ve onlara bağlı çizgiler aynı rengi taşır. Büyük ağaçlarda hangi çocuğun hangi aileye ait olduğu hemen anlaşılır."
  },
  {
    q: "Co-admin nasıl atanır?",
    a: "⚙️ Settings menüsünden e-posta adresi girerek co-admin ekleyebilirsiniz."
  },
]

export default function HelpPanel() {
  const [open, setOpen] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  const qa = isMobile ? MOBILE_QA : DESKTOP_QA

  return (
    <>
      {/* Help button */}
      <button className={styles.helpBtn} onClick={() => setOpen(true)} title="Help">
        ?
      </button>

      {/* Panel */}
      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.panel} onClick={e => e.stopPropagation()}>
            <div className={styles.header}>
              <h2 className={styles.title}>
                {isMobile ? '📱 Nasıl Kullanılır?' : '💻 Nasıl Kullanılır?'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className={styles.list}>
              {qa.map((item, i) => (
                <div key={i} className={styles.item}>
                  <button
                    className={`${styles.question} ${openIdx === i ? styles.questionOpen : ''}`}
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className={styles.arrow}>{openIdx === i ? '▲' : '▼'}</span>
                  </button>
                  {openIdx === i && (
                    <div className={styles.answer}>{item.a}</div>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.footer}>Developed for Yami 🌳</div>
          </div>
        </div>
      )}
    </>
  )
}
