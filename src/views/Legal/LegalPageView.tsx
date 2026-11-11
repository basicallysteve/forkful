import styles from './LegalPageView.module.scss'

interface Props {
  title: string
  effectiveDate?: string
  children: React.ReactNode
}

export default function LegalPageView({ title, effectiveDate, children }: Props) {
  return (
    <article className={styles.article}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {effectiveDate && (
          <p className={styles.effectiveDate}>
            Effective{' '}
            <time dateTime={String(effectiveDate)}>
              {new Date(String(effectiveDate)).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          </p>
        )}
      </header>
      <div className={styles.body}>{children}</div>
    </article>
  )
}
