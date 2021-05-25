/* eslint-disable no-param-reassign */
/* eslint-disable no-return-assign */
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/Head';
import { RichText } from 'prismic-dom';
import Prismic from '@prismicio/client';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import Link from 'next/link';
import { FiCalendar, FiUser, FiClock } from 'react-icons/fi';
import Header from '../../components/Header';

import { getPrismicClient } from '../../services/prismic';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';
import Comments from '../../components/Comments';

interface Post {
  uid: string;
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    subtitle: string;
    author: string;
    banner: {
      url: string;
    };
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}

interface PostProps {
  post: Post;
  preview: boolean;
  navigation: {
    prevPost: {
      uid: string;
      data: {
        title: string;
      };
    }[];
    nextPost: {
      uid: string;
      data: {
        title: string;
      };
    }[];
  };
}

export default function Post({
  post,
  preview,
  navigation,
}: PostProps): JSX.Element {
  const totalWords = post.data.content.reduce((total, item) => {
    total += item.heading.split(' ').length;

    const bodyWords = item.body.map(content => content.text.split(' ').length);
    bodyWords.map(word => (total += word));

    return total;
  }, 0);

  const readTime = Math.ceil(totalWords / 200);

  const router = useRouter();

  if (router.isFallback) {
    return <h1>Carregando...</h1>;
  }

  const formattedDate = format(
    new Date(post.first_publication_date),
    'dd MMM yyyy',
    {
      locale: ptBR,
    }
  );

  const isPostEdited =
    post.first_publication_date !== post.last_publication_date;

  let editDate;

  if (isPostEdited) {
    editDate = format(
      new Date(post.last_publication_date),
      "'* editado em' dd MMM yyyy', às' H':'mm",
      {
        locale: ptBR,
      }
    );
  }

  return (
    <>
      <Head>
        <title>{post.data.title} | spacetravelling.</title>
      </Head>

      <Header />

      <img src={post.data.banner.url} alt="imagem" className={styles.banner} />

      <main className={commonStyles.container}>
        <div className={styles.post}>
          <div className={styles.postHeader}>
            <h1>{post.data.title}</h1>

            <div className={styles.infoContainer}>
              <div className={styles.info}>
                <FiCalendar />
                <span>{formattedDate}</span>
              </div>

              <div className={styles.info}>
                <FiUser />
                <span>{post.data.author}</span>
              </div>

              <div className={styles.info}>
                <FiClock />
                <span>{`${readTime} min`}</span>
              </div>
            </div>
            {isPostEdited && <span>{editDate}</span>}
          </div>

          {post.data.content.map(content => {
            return (
              <article key={content.heading}>
                <h2>{content.heading}</h2>

                <div
                  className={styles.postContent}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: RichText.asHtml(content.body),
                  }}
                />
              </article>
            );
          })}
        </div>

        <section className={`${styles.navigation} ${commonStyles.container}`}>
          {navigation?.prevPost.length > 0 && (
            <div
              style={
                navigation.nextPost.length === 0
                  ? { textAlign: 'left', marginRight: 'auto' }
                  : {}
              }
            >
              <h3>{navigation.prevPost[0].data.title}</h3>
              <Link href={`/post/${navigation.prevPost[0].uid}`}>
                <a>Post anterior</a>
              </Link>
            </div>
          )}

          {navigation?.nextPost.length > 0 && (
            <div
              style={
                navigation.prevPost.length === 0
                  ? { textAlign: 'right', marginLeft: 'auto' }
                  : {}
              }
            >
              <h3>{navigation.nextPost[0].data.title}</h3>
              <Link href={`/post/${navigation.nextPost[0].uid}`}>
                <a>Próximo Post</a>
              </Link>
            </div>
          )}
        </section>

        <Comments />
        {preview && (
          <aside>
            <Link href="/api/exit-preview">
              <a className={commonStyles.preview}>Sair do modo preview</a>
            </Link>
          </aside>
        )}
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query([
    Prismic.predicates.at('document.type', 'posts'),
  ]);

  const paths = posts.results.map(post => ({
    params: {
      slug: post.uid,
    },
  }));

  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
  previewData,
}) => {
  const prismic = getPrismicClient();
  const { slug } = params;

  const response = await prismic.getByUID('posts', String(slug), {
    ref: previewData?.ref || null,
  });

  const prevPost = await prismic.query(
    [Prismic.predicates.at('document.type', 'posts')],
    {
      pageSize: 1,
      after: response.id,
      orderings: '[document.first_publication_date]',
    }
  );

  const nextPost = await prismic.query(
    [Prismic.predicates.at('document.type', 'posts')],
    {
      pageSize: 1,
      after: response.id,
      orderings: '[document.last_publication_date desc]',
    }
  );

  const post = {
    uid: response.uid,
    first_publication_date: response.first_publication_date,
    last_publication_date: response.last_publication_date,
    data: {
      title: response.data.title,
      subtitle: response.data.subtitle,
      author: response.data.author,
      banner: {
        url: response.data.banner.url,
      },
      content: response.data.content.map(content => ({
        heading: content.heading,
        body: [...content.body],
      })),
    },
  };

  return {
    props: {
      post,
      navigation: {
        prevPost: prevPost?.results,
        nextPost: nextPost?.results,
      },
      preview,
    },
  };
};
