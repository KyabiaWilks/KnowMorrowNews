import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Article, NewsItem } from '../lib/types';
import { Spinner } from '../components/ui';
import { fmtEasternDateTime, tmt } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TomatoIcon } from '../components/TomatoIcon';

export default function ArticlePage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ article: Article; related: NewsItem[] } | null>(null);
  const [error, setError] = useState('');
  const [tipAmount, setTipAmount] = useState(1);
  const [tipping, setTipping] = useState(false);
  useEffect(() => {
    setError('');
    setData(null);
    void get<{ article: Article; related: NewsItem[] }>(`/news/${id}`).then(setData).catch((reason) => setError(reason.message));
  }, [id]);
  useEffect(() => {
    if (data?.article.slug && id === data.article.id && id !== data.article.slug) {
      window.history.replaceState(window.history.state, '', `/news/${data.article.slug}`);
    }
  }, [data, id]);
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <Spinner />;
  const { article } = data;
  const dialogueInRightStoryColumn = [
    'yo-uh-i-think-my-eyes-just-watched-the-most-horrifying-stuff',
    'the-craziest-stuff-just-happened-to-me-in-the-event',
  ].includes(article.slug);
  const manualInterviewFirstColumnCount = article.slug === 'interview-sneeeper-the-wandering-bard'
    ? 4
    : article.slug === 'the-war-of-fluixon-s-cozy-caf-part-3'
      ? 5
      : null;
  const tipStory = async () => {
    if (!user) {
      toast.push('Sign in before tipping a news article.', 'bad');
      return;
    }
    setTipping(true);
    try {
      const result = await post<{ tomatoTips: number }>(`/news/${article.id}/tip`, { amount: tipAmount });
      setData((current) => current ? { ...current, article: { ...current.article, tomatoTips: result.tomatoTips } } : current);
      await refresh();
      toast.push(`You tipped this news article ${tmt(tipAmount)}.`, 'good');
    } catch (reason) {
      toast.push((reason as Error).message, 'bad');
    } finally {
      setTipping(false);
    }
  };
  const linkedText = (text: string) => text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g).map((part, index) => {
    const markdownLink = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    if (markdownLink) return <a href={markdownLink[2]} target="_blank" rel="noopener noreferrer" key={index}>{markdownLink[1]}</a>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return /^https?:\/\//.test(part) ? <a href={part} target="_blank" rel="noopener noreferrer" key={index}>{part}</a> : part;
  });
  const sourceParagraphs = article.body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const paragraphs = article.series === 'thegunrat-quotes' ? sourceParagraphs.flatMap((paragraph) => {
    if (/^Q\d+(?:\s+\[[^\]]+\])?:\s/.test(paragraph) || paragraph.length <= 680) return [paragraph];
    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["”']?|$)\s*/g)?.map((value) => value.trim()).filter(Boolean) || [paragraph];
    const chunks: string[] = [];
    let chunk = '';
    for (const sentence of sentences) {
      if (chunk && `${chunk} ${sentence}`.length > 520) {
        chunks.push(chunk);
        chunk = sentence;
      } else {
        chunk = `${chunk}${chunk ? ' ' : ''}${sentence}`;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  }) : sourceParagraphs;
  const interviewGroups = new Map<number, { number: string; questioner: string; respondent: string; question: string; answers: string[]; consumed: number[] }>();
  const questionIndexes = paragraphs.map((paragraph, index) => /^Q\d+(?:\s+\[[^\]]+\])?:\s/.test(paragraph) ? index : -1).filter((index) => index >= 0);
  const firstInterviewIndex = questionIndexes[0] ?? paragraphs.length;
  const isInterviewOnly = questionIndexes.length > 0 && firstInterviewIndex === 0;
  const openingParagraphCount = article.openingParagraphCount !== undefined
    ? Math.max(0, Math.min(article.openingParagraphCount, firstInterviewIndex))
    : questionIndexes.length
      ? Math.min(3, firstInterviewIndex)
    : article.slug === 'no-war-tomorrow-the-lordeaux-valengrad-rumor'
      ? 1
    : article.id === 'news_ministry_of_truth_logo'
      ? 5
      : article.id === 'news_cold_island_great_heist'
        ? 5
      : article.id === 'news_placeholder'
        ? 3
      : 2;
  const shouldPaginateStory = false;
  const frontStoryStart = shouldPaginateStory ? 0 : openingParagraphCount;
  const frontStoryEnd = shouldPaginateStory ? Math.min(1, paragraphs.length) : firstInterviewIndex;
  const frontStoryParagraphs = paragraphs.slice(frontStoryStart, frontStoryEnd);
  const dangerIndex = paragraphs.findIndex((paragraph) => paragraph.startsWith('[[DANGER]]\n'));
  const dangerIsInFrontStory = dangerIndex >= frontStoryStart && dangerIndex < frontStoryEnd;
  const frontStoryEntries = frontStoryParagraphs
    .map((paragraph, offset) => ({ paragraph, index: offset + frontStoryStart }))
    .filter(({ index }) => !dangerIsInFrontStory || index !== dangerIndex);
  const frontStoryLength = frontStoryEntries.map(({ paragraph }) => paragraph).join(' ').length;
  const useBalancedColumns = frontStoryEntries.length >= 2 && frontStoryLength >= 560;
  const continuationChunks: { start: number; paragraphs: string[] }[] = [];
  if (shouldPaginateStory) {
    for (let start = frontStoryEnd; start < paragraphs.length; start += 3) {
      continuationChunks.push({ start, paragraphs: paragraphs.slice(start, start + 3) });
    }
  }
  questionIndexes.forEach((start, questionIndex) => {
    const end = questionIndexes[questionIndex + 1] ?? paragraphs.length;
    const [questionLine, ...firstAnswer] = paragraphs[start].split('\n');
    const match = /^Q(\d+)(?:\s+\[([^\]]+)\])?:\s*(.+)$/.exec(questionLine);
    if (!match) return;
    const rawAnswers = [...(firstAnswer.length ? [firstAnswer.join('\n')] : []), ...paragraphs.slice(start + 1, end)];
    const respondentMatch = /^\[([^\]]+)\]:\s*/.exec(rawAnswers[0] || '');
    const answers = rawAnswers.map((answer, answerIndex) => answerIndex === 0 ? answer.replace(/^\[[^\]]+\]:\s*/, '') : answer);
    interviewGroups.set(start, { number: match[1], questioner: match[2] || 'Enigma', respondent: respondentMatch?.[1] || 'Kyabia', question: match[3], answers, consumed: Array.from({ length: end - start - 1 }, (_, offset) => start + offset + 1) });
  });
  const consumedInterviewParagraphs = new Set([...interviewGroups.values()].flatMap((group) => group.consumed));
  const easternDateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).formatToParts(new Date(article.publishedAt));
  const easternMonth = easternDateParts.find((part) => part.type === 'month')?.value || '';
  const easternDay = easternDateParts.find((part) => part.type === 'day')?.value || '';
  const calendarHeadingIndex = paragraphs.findIndex((paragraph) => paragraph.startsWith('Event Calendar —'));
  const dialogueAvatar = (name: string, side: 'question' | 'answer') => {
    const normalized = name.toLowerCase();
    const journalist = article.contributorCards.find((contributor) =>
      [contributor.name, ...(contributor.aliases || [])].some((candidate) => normalized.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalized))
    );
    const src = article.dialogueAvatars?.[normalized] || journalist?.avatar || (normalized.includes('enigma')
      ? '/journalists/enigma-mc-avatar.png'
      : normalized.includes('kyabia')
        ? '/journalists/kyabia-mc-avatar.png'
        : side === 'answer' ? article.cover : null);
    return src ? <img src={src} alt={`${name} avatar`} /> : <span className={`article-dialogue__initial article-dialogue__initial--${side}`} aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || '?'}</span>;
  };
  const youtubeVideoId = (value: string) => {
    const short = /^https?:\/\/(?:www\.)?youtu\.be\/([^?&#/]+)/i.exec(value);
    if (short) return short[1];
    const standard = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?[^#]*v=|embed\/|shorts\/)([^?&#/]+)/i.exec(value);
    return standard?.[1] || null;
  };
  const renderInlineImages = (index: number) => {
    const media = (article.media || []).filter((item) => item.afterParagraph === index);
    if (!media.length) return null;
    if (media.length === 1) {
      const item = media[0];
      const videoId = item.type === 'youtube' ? youtubeVideoId(item.src) : null;
      if (videoId) return <figure className="article-inline-image article-inline-video"><div className="article-inline-video__frame"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={item.alt} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>;
      return <figure className="article-inline-image"><img src={item.src} alt={item.alt} />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>;
    }
    const images = media.filter((item) => item.type !== 'youtube');
    const videos = media.map((item) => ({ item, videoId: item.type === 'youtube' ? youtubeVideoId(item.src) : null })).filter(({ videoId }) => !!videoId);
    const imageCaption = images.map((item) => item.caption).find(Boolean);
    return <Fragment>
      {images.length === 1 && <figure className="article-inline-image"><img src={images[0].src} alt={images[0].alt} />{images[0].caption && <figcaption>{images[0].caption}</figcaption>}</figure>}
      {images.length > 1 && <figure className="article-inline-image article-inline-image--gallery"><div className="article-inline-gallery">{images.map((image) => <img src={image.src} alt={image.alt} key={image.src} />)}</div>{imageCaption && <figcaption>{imageCaption}</figcaption>}</figure>}
      {videos.map(({ item, videoId }) => <figure className="article-inline-image article-inline-video" key={item.src}><div className="article-inline-video__frame"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={item.alt} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}
    </Fragment>;
  };
  const renderParagraph = (paragraph: string, index: number) => {
    if (consumedInterviewParagraphs.has(index)) return null;
    const interview = interviewGroups.get(index);
    if (interview) return <Fragment key={index}><section className="article-dialogue" aria-label={`Interview question ${interview.number}`}>
      <div className="article-dialogue__turn article-dialogue__turn--enigma">
        {dialogueAvatar(interview.questioner, 'question')}
        <div className="article-dialogue__bubble"><span>{interview.questioner} · Q{interview.number}</span><strong>{interview.question}</strong></div>
      </div>
      <div className="article-dialogue__turn article-dialogue__turn--kyabia">
        {dialogueAvatar(interview.respondent, 'answer')}
        <div className="article-dialogue__bubble"><span>{interview.respondent}</span>{interview.answers.map((answer, answerIndex) => <p key={answerIndex}>{linkedText(answer)}</p>)}</div>
      </div>
    </section>{renderInlineImages(index)}</Fragment>;
    if (index === calendarHeadingIndex) {
      const [heading, ...description] = paragraph.split('\n');
      return <section className="event-calendar-heading" key={index}><h2>{heading}</h2>{description.length > 0 && <p>{linkedText(description.join(' '))}</p>}</section>;
    }
    if (index === calendarHeadingIndex + 1 && calendarHeadingIndex >= 0) {
      const rows = paragraph.split('\n').map((line) => /^([^,]+),\s+(.+?)\s+—\s+(.+?)\s+·\s+(.+)$/.exec(line.trim())).filter((match): match is RegExpExecArray => !!match);
      if (rows.length > 0) return <div className="event-calendar-table-wrap" key={index}><table className="event-calendar-table"><thead><tr><th>Day</th><th>Date</th><th>Session</th><th>Time</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row[1]}-${row[2]}`}><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td></tr>)}</tbody></table></div>;
    }
    if (paragraph.startsWith('[[DANGER]]\n')) {
      const lines = paragraph.split('\n').slice(1).filter(Boolean);
      const intro = lines.find((line) => !line.startsWith('- ')) || '';
      const dangers = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
      return <Fragment key={index}>{renderInlineImages(index)}<section className="article-danger-callout"><div className="article-danger-callout__label"><span aria-hidden="true">!</span> Surveillance risk assessment</div><p>{linkedText(intro)}</p><ul>{dangers.map((danger) => <li key={danger}>{linkedText(danger)}</li>)}</ul></section></Fragment>;
    }
    if (paragraph.startsWith('[[PRIZES]]\n')) {
      const lines = paragraph.split('\n').slice(1).filter(Boolean);
      const intro = lines.find((line) => !line.startsWith('- ')) || '';
      const prizes = lines.filter((line) => line.startsWith('- ')).map((line) => {
        const match = /^- \*\*(.+?):\*\*\s*(.+)$/.exec(line);
        return { label: match?.[1] || 'Prize', description: match?.[2] || line.slice(2) };
      });
      return <Fragment key={index}><section className="article-prize-callout"><header><span>Community writing competition</span><h2>Your Homeland Story Awards</h2><p>{linkedText(intro)}</p></header><ol>{prizes.map((prize, prizeIndex) => <li key={prize.label} data-place={prizeIndex + 1}><span className="article-prize-callout__medal">{prizeIndex + 1}</span><div><strong>{prize.label}</strong><p>{linkedText(prize.description)}</p></div></li>)}</ol></section>{renderInlineImages(index)}</Fragment>;
    }
    if (paragraph.startsWith('[[FALLEN]]\n')) {
      const names = paragraph.split('\n').slice(1).map((name) => name.trim()).filter(Boolean);
      return <section className="article-memorial-roll" key={index}><header><span aria-hidden="true">✦</span><div><div className="paper-label">In memoriam</div><h2>The Fallen of Day 4</h2></div><span aria-hidden="true">✦</span></header><div className="article-memorial-roll__names">{names.map((name) => <strong key={name}>{name}</strong>)}</div><footer>May their names remain with us.</footer></section>;
    }
    const sectionMatch = /^\*\*(.+?)\*\*\n([\s\S]+)$/.exec(paragraph);
    return <Fragment key={index}>{sectionMatch ? <section className="article-section-block"><h2>{sectionMatch[1]}</h2><p>{linkedText(sectionMatch[2])}</p></section> : <p>{linkedText(paragraph)}</p>}{renderInlineImages(index)}</Fragment>;
  };
  const articleRail = <aside className="paper-rail">
    {article.cover && <figure className="paper-feature-image"><img src={article.cover} alt={`Cover image for ${article.title}`} /><figcaption>{article.summary}{article.visualCredit && <><br /><strong>{article.visualCredit}</strong></>}</figcaption></figure>}
    <section className="paper-contributors"><div className="paper-label">Contributors</div>{article.contributorCards.length ? article.contributorCards.map((contributor) => <Link key={contributor.id} to={`/journalists/${contributor.id}`}><strong>{contributor.name}</strong><span>{contributor.roles.join(' · ')}</span></Link>) : <div><strong>Know Morrow Editorial Desk</strong><span>Event desk</span></div>}{article.visualCredit && !article.illustratorIds.length && <div><strong>Visual credit</strong><span>{article.visualCredit}</span></div>}</section>
    <section className="paper-tip">
      <TomatoIcon variant={4} size={64} />
      <div><div className="paper-label">Tip with tomatoes</div><strong>{article.tomatoTips.toLocaleString('en-US', { maximumFractionDigits: 2 })} TMT</strong></div>
      <p>Reward the reporting with at least 1 TMT.</p>
      <div className="paper-tip-controls"><input className="input" type="number" min={1} max={100000} step={1} value={tipAmount} onChange={(event) => setTipAmount(Math.max(1, Number(event.target.value) || 1))} /><button className="btn btn--primary" disabled={tipping || user?.readOnly} onClick={tipStory}>{tipping ? 'Sending…' : user ? 'Send tip' : 'Sign in to tip'}</button></div>
    </section>
    <section className="paper-lead"><div className="paper-label">Have a lead?</div><p>Bring confidential information to the Tavern under a mask.</p><Link to="/tavern/compose">Submit a tip →</Link></section>
  </aside>;
  return <article className={`paper-article${continuationChunks.length ? ' paper-article--paged' : ''}`}>
    {!isInterviewOnly && <>
    <section className="paper-page paper-page--front">
    <div className="paper-editorial-grid">
    <div className="paper-title-column">
    <header className="paper-masthead">
      <div className="paper-date"><span>{easternMonth}</span><strong>{easternDay}</strong></div>
      <div className="paper-logo"><img src="/news-paper/head.png" alt="Know Morrow Newspaper" width="2680" height="1255" fetchPriority="high" /></div>
      <div className="paper-issue"><span>Vol. {article.volume || 1}</span><strong>No. {article.issueNumber || 1}</strong></div>
    </header>
    <div className="paper-rule"><span>KNOW YOUR ENEMIES · KNOW YOURSELF · KNOW WHAT IS SOON TO COME</span></div>
    <section className="paper-lede">
      <div className="paper-kicker">{article.section} · {article.dateline || 'Know Morrow Editorial Desk'}</div>
      <h1>{article.title}</h1>
      <p className="paper-deck">{article.summary}</p>
      <div className="paper-byline"><span>Published {fmtEasternDateTime(article.publishedAt)}</span><span>{article.readingMinutes} minute read</span><span>{article.views} views</span></div>
      {!shouldPaginateStory && <div className="paper-lede-copy">{paragraphs.slice(0, openingParagraphCount).map(renderParagraph)}</div>}
    </section>
    </div>
    <div className="paper-story-grid">
      <section className={`paper-copy${useBalancedColumns ? ' paper-copy--balanced' : ' paper-copy--single'}`}>
        {frontStoryEntries.map(({ paragraph, index }) => renderParagraph(paragraph, index))}
        {dialogueInRightStoryColumn && <div className="article-dialogue-column">{questionIndexes.map((index) => renderParagraph(paragraphs[index], index))}</div>}
        {!dangerIsInFrontStory && !questionIndexes.length && !continuationChunks.length && <div className="paper-tags">{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}>{value}</Link>)}</div>}
      </section>
      {articleRail}
    </div>
    {dangerIsInFrontStory && <section className="paper-editorial-wide">{renderParagraph(paragraphs[dangerIndex], dangerIndex)}{!questionIndexes.length && !continuationChunks.length && <div className="paper-tags">{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}>{value}</Link>)}</div>}</section>}
    </div>
    </section>
    {continuationChunks.map((chunk, chunkIndex) => <section className="paper-page paper-continuation-page" key={chunk.start}>
      <header className="paper-continuation-page__header"><div><span>Know Morrow News</span><strong>Continued from Page {chunkIndex + 1}</strong></div><div><span>Vol. {article.volume || 1}</span><strong>Page {chunkIndex + 2}</strong></div></header>
      <div className="paper-continuation-page__title"><div className="paper-label">{article.section}</div><h2>{article.title}</h2></div>
      <section className="paper-copy paper-continuation-copy">{chunk.paragraphs.map((paragraph, index) => renderParagraph(paragraph, chunk.start + index))}</section>
      {chunkIndex === continuationChunks.length - 1 && <div className="paper-tags">{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}>{value}</Link>)}</div>}
      {chunkIndex === continuationChunks.length - 1 && <div className="paper-continuation-actions">
        <section className="paper-tip">
          <TomatoIcon variant={4} size={64} />
          <div><div className="paper-label">Tip with tomatoes</div><strong>{article.tomatoTips.toLocaleString('en-US', { maximumFractionDigits: 2 })} TMT</strong></div>
          <p>Reward the reporting with at least 1 TMT.</p>
          <div className="paper-tip-controls"><input className="input" type="number" min={1} max={100000} step={1} value={tipAmount} onChange={(event) => setTipAmount(Math.max(1, Number(event.target.value) || 1))} /><button className="btn btn--primary" disabled={tipping || user?.readOnly} onClick={tipStory}>{tipping ? 'Sending…' : user ? 'Send tip' : 'Sign in to tip'}</button></div>
        </section>
        <section className="paper-lead"><div className="paper-label">Have a lead?</div><p>Bring confidential information to the Tavern under a mask.</p><Link to="/tavern/compose">Submit a tip →</Link></section>
      </div>}
    </section>)}</>}
    {questionIndexes.length > 0 && !dialogueInRightStoryColumn && <div className={isInterviewOnly ? 'paper-story-grid paper-story-grid--interview' : undefined}><section className={`article-interview-layout${isInterviewOnly ? ' article-interview-layout--standalone' : ''}`}>
      <header className="article-interview-layout__header"><div className="paper-label">Questions &amp; Answers</div><h1>{article.title}</h1><p className="article-interview-layout__summary">{article.summary}</p><div className="paper-byline"><span>Published {fmtEasternDateTime(article.publishedAt)}</span><span>{article.views} views</span></div></header>
      <div className={`article-interview-layout__conversation${manualInterviewFirstColumnCount !== null ? ' article-interview-layout__conversation--manual' : ''}`}>
        {manualInterviewFirstColumnCount !== null ? <>
          <div>{questionIndexes.slice(0, manualInterviewFirstColumnCount).map((index) => renderParagraph(paragraphs[index], index))}</div>
          <div>{questionIndexes.slice(manualInterviewFirstColumnCount).map((index) => renderParagraph(paragraphs[index], index))}</div>
        </> : questionIndexes.map((index) => renderParagraph(paragraphs[index], index))}
      </div>
      <div className="paper-tags">{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}>{value}</Link>)}</div>
    </section>{isInterviewOnly && articleRail}</div>}
    <footer className="paper-folio"><span>Ketchup on the latest scoop!</span><span>Know Morrow News · Page 1</span></footer>
  </article>;
}
