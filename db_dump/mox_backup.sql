--
-- PostgreSQL database dump
--

\restrict Cxu9tE7jSEh54hkOGqD0LVWG87WXzfxir6uLxsZszLxZBQNu59AFVGs6DdLmQ4n

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    last_edited_at timestamp with time zone NOT NULL,
    task_id integer NOT NULL,
    CONSTRAINT collections_check CHECK ((last_edited_at >= created_at)),
    CONSTRAINT collections_created_at_check CHECK ((created_at >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.collections OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.collections_id_seq OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    user_id integer NOT NULL,
    media_id integer NOT NULL,
    CONSTRAINT comments_created_at_check CHECK ((created_at >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media (
    id integer NOT NULL,
    path text NOT NULL,
    name text NOT NULL,
    format character varying(10) NOT NULL,
    description text,
    upload_at timestamp with time zone NOT NULL,
    status_id integer NOT NULL,
    collection_id integer NOT NULL,
    CONSTRAINT media_upload_at_check CHECK ((upload_at >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_id_seq OWNER TO postgres;

--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name text NOT NULL,
    goal text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status_id integer NOT NULL,
    CONSTRAINT projects_check CHECK ((end_date > start_date)),
    CONSTRAINT projects_start_date_check CHECK ((start_date >= '2026-05-01'::date))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: statuses_media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses_media (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.statuses_media OWNER TO postgres;

--
-- Name: statuses_media_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.statuses_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statuses_media_id_seq OWNER TO postgres;

--
-- Name: statuses_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.statuses_media_id_seq OWNED BY public.statuses_media.id;


--
-- Name: statuses_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses_projects (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.statuses_projects OWNER TO postgres;

--
-- Name: statuses_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.statuses_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statuses_projects_id_seq OWNER TO postgres;

--
-- Name: statuses_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.statuses_projects_id_seq OWNED BY public.statuses_projects.id;


--
-- Name: statuses_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses_tasks (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.statuses_tasks OWNER TO postgres;

--
-- Name: statuses_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.statuses_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statuses_tasks_id_seq OWNER TO postgres;

--
-- Name: statuses_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.statuses_tasks_id_seq OWNED BY public.statuses_tasks.id;


--
-- Name: statuses_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses_users (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.statuses_users OWNER TO postgres;

--
-- Name: statuses_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.statuses_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statuses_users_id_seq OWNER TO postgres;

--
-- Name: statuses_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.statuses_users_id_seq OWNED BY public.statuses_users.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    deadline timestamp with time zone NOT NULL,
    role_id integer NOT NULL,
    project_id integer NOT NULL,
    status_id integer NOT NULL,
    CONSTRAINT tasks_deadline_check CHECK ((deadline >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: user_project; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_project (
    id integer NOT NULL,
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    included_at timestamp with time zone NOT NULL,
    excluded_at timestamp with time zone,
    CONSTRAINT user_project_included_at_check CHECK ((included_at >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.user_project OWNER TO postgres;

--
-- Name: user_project_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_project_id_seq OWNER TO postgres;

--
-- Name: user_project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_project_id_seq OWNED BY public.user_project.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    registered_at timestamp with time zone NOT NULL,
    status_id integer NOT NULL,
    role_id integer NOT NULL,
    CONSTRAINT users_registered_at_check CHECK ((registered_at >= '2026-05-01 00:00:00+00'::timestamp with time zone))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: statuses_media id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_media ALTER COLUMN id SET DEFAULT nextval('public.statuses_media_id_seq'::regclass);


--
-- Name: statuses_projects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_projects ALTER COLUMN id SET DEFAULT nextval('public.statuses_projects_id_seq'::regclass);


--
-- Name: statuses_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_tasks ALTER COLUMN id SET DEFAULT nextval('public.statuses_tasks_id_seq'::regclass);


--
-- Name: statuses_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_users ALTER COLUMN id SET DEFAULT nextval('public.statuses_users_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: user_project id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_project ALTER COLUMN id SET DEFAULT nextval('public.user_project_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.collections (id, name, description, created_at, last_edited_at, task_id) FROM stdin;
1	Территория отеля и природа	Фотографии внешней территории отеля, зелёных зон, дорожек, панорамных видов и окружающего природного ландшафта	2026-05-18 14:31:24.557922+00	2026-05-18 14:31:24.557922+00	1
2	Номера и интерьер	Интерьеры стандартных и улучшенных номеров, детали оформления, освещение, мебель и атмосфера уюта	2026-05-18 14:31:55.610897+00	2026-05-18 14:31:55.610897+00	1
3	Зоны отдыха и инфраструктура	Фотографии лаунж-зон, ресторана, террасы, спа-зоны и других общественных пространств отеля	2026-05-18 14:32:05.659466+00	2026-05-18 14:32:05.659466+00	1
4	Атмосфера отдыха	Видео с медленными панорамами природы, закатами, тишиной и спокойной атмосферой эко-отеля	2026-05-18 14:32:16.417338+00	2026-05-18 14:32:16.417338+00	2
5	Прогулочные маршруты	Кадры прогулок по территории, лесным дорожкам, тропинкам и обзорным точкам	2026-05-18 14:32:26.952476+00	2026-05-18 14:32:26.952476+00	2
7	Преимущества эко-отдыха	Материалы о пользе отдыха на природе, экологической концепции отеля и восстановлении ресурсов организма	2026-05-18 14:32:48.794692+00	2026-05-18 14:32:48.794692+00	3
8	Сезонные предложения	Тексты, посвящённые акциям, скидкам и специальным предложениям в разные сезоны	2026-05-18 14:32:58.355378+00	2026-05-18 14:32:58.355378+00	3
9	История и философия бренда	Контент о миссии отеля, его ценностях, устойчивом развитии и философии экологичного туризма	2026-05-18 14:33:07.82417+00	2026-05-18 14:33:07.82417+00	3
10	Дрон-съёмка побережья	Исходные видеоматериалы с дрона: панорамные пролёты над морем, береговой линией и прибрежными ландшафтами	2026-05-18 14:35:04.195967+00	2026-05-18 14:35:04.195967+00	4
11	Закатные сцены	Видеофрагменты закатов над морем, переходы света, отражения на воде и атмосферные кадры вечернего времени	2026-05-18 14:35:13.399367+00	2026-05-18 14:35:13.399367+00	4
12	Горные и лесные ландшафты	Снимки гор, лесов, дорожек и природных маршрутов для публикаций о путешествиях	2026-05-18 14:36:16.917459+00	2026-05-18 14:36:16.917459+00	6
13	Побережье и море	Фотографии морских пейзажей, пляжей, волн и прибрежной линии в разное время суток	2026-05-18 14:36:30.339702+00	2026-05-18 14:36:30.339702+00	6
14	Процесс приготовления кофе	Кадры приготовления эспрессо, капучино и авторских напитков, включая работу бариста и детали оборудования	2026-05-18 14:38:30.3272+00	2026-05-18 14:38:30.3272+00	7
15	Кофейная атмосфера заведения	Видеофрагменты интерьера кофейни, общего зала, барной стойки и атмосферы заведения в разные периоды дня	2026-05-18 14:39:17.979245+00	2026-05-18 14:39:17.979245+00	7
16	Фирменные напитки и сезонное меню	Съёмка авторских и сезонных напитков, акцент на визуальной привлекательности и ингредиентах	2026-05-18 14:39:39.2094+00	2026-05-18 14:39:39.2094+00	8
17	Интерактивные сторис	Материалы для опросов, викторин, голосований и вовлечения аудитории в Instagram Stories	2026-05-18 14:40:03.249081+00	2026-05-18 14:40:03.249081+00	9
18	Акции и специальные предложения	Контент, посвящённый скидкам, промокодам, сезонным акциям и программам лояльности	2026-05-18 14:40:14.28768+00	2026-05-18 14:40:14.28768+00	9
19	картинки для ловли внимания		2026-05-18 14:41:04.312029+00	2026-05-18 14:41:04.312029+00	8
6	Эмоции гостей	Ролики и фото с людьми, отдыхающими на территории отеля, создающие ощущение живого пространства	2026-05-18 14:32:36.463194+00	2026-05-18 14:48:31.374157+00	2
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, text, created_at, user_id, media_id) FROM stdin;
1	Забавная! Действительно привлечёт!	2026-05-18 15:12:44.233569+00	2	3
2	Хаха, действительно забавный! Точно привлечет, я уверен	2026-05-18 15:21:13.020523+00	8	2
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media (id, path, name, format, description, upload_at, status_id, collection_id) FROM stdin;
1	/storage/fb006535-8f5d-4924-9505-4121007f6c78.gif	Cat Cringe GIF.gif	gif		2026-05-18 14:41:27.187587+00	1	19
2	/storage/a1e037c2-f9f4-46a7-a129-e4dee0aa4275.gif	Cat GIF.gif	gif		2026-05-18 14:41:27.220376+00	1	19
3	/storage/2c9740f6-ca0e-4e48-8b4e-551e07f44781.gif	Be Like Big Eyes GIF.gif	gif		2026-05-18 14:41:27.232199+00	1	19
4	/storage/43d68b47-19ba-4a2b-b5c2-4bc11f4e1f2a.mp4	169443-841382814_medium.mp4	mp4	Розовый закат у моря по центру	2026-05-18 14:43:10.969685+00	1	11
5	/storage/fdca2d71-eff9-4b15-bbda-6b8f607c3816.jpg	truongdinhanh-vietnam-9908601_1920.jpg	jpg		2026-05-18 14:43:10.98161+00	1	11
6	/storage/d095e703-155e-4d55-84f0-df513ae98245.mp4	179207-861403607_medium.mp4	mp4	Животные (коровы) у леса	2026-05-18 14:45:14.115242+00	1	12
7	/storage/4d7ac2bb-8cdc-4805-822d-4842f5f9b5b8.mp4	186405-877993676_medium.mp4	mp4	Река у леса	2026-05-18 14:45:14.291771+00	1	12
8	/storage/79f0ffbc-d9ce-4522-8865-9bada59f4bfc.png	anek0o-etretat-10134406_1920.png	png		2026-05-18 14:45:14.319278+00	1	12
9	/storage/ffe5d88c-b1f9-4d68-ab6f-d5a15448662f.jpg	martinophuc-cows-8496434_1920.jpg	jpg		2026-05-18 14:45:14.333836+00	1	12
10	/storage/1937c718-9fef-49a5-b4ee-d64d0965c87e.jpg	neelam279-lambs-10194539_1920.jpg	jpg		2026-05-18 14:45:14.347266+00	1	12
11	/storage/1d057e4d-ef5f-4f4c-bfe0-80350165b203.jpg	nunziog666-mountains-10253276_1920.jpg	jpg		2026-05-18 14:45:14.360644+00	1	12
12	/storage/406b8938-ae52-450d-a97f-44d6b7b998bd.jpg	sightseer-nepal-9352723_1920.jpg	jpg		2026-05-18 14:45:14.376809+00	1	12
13	/storage/9bd7bd01-510e-49a0-8bf4-546806050eea.jpg	truongdinhanh-vietnam-9908601_1920.jpg	jpg		2026-05-18 14:46:17.210701+00	1	13
14	/storage/eed4fe6a-0a10-4680-af0c-5592d8d8823b.jpg	studio_lichtfang-to-stage-9858926_1920.jpg	jpg		2026-05-18 14:46:17.22335+00	1	13
15	/storage/ba061fb0-e75d-4d75-9145-33500b402b97.png	anek0o-etretat-10134406_1920.png	png		2026-05-18 14:46:17.250479+00	1	13
16	/storage/c3ecc0b9-9e23-45ad-a87f-ed09898f6765.mp4	185096-874643413_medium.mp4	mp4	Книга на побережье	2026-05-18 14:46:17.29116+00	1	13
17	/storage/ad3f6145-91b7-4944-9e67-a29990b62928.jpg	chuan-lxBXK41lecQ-unsplash.jpg	jpg		2026-05-18 14:47:24.363403+00	1	10
18	/storage/b4d6a912-cd79-4f4c-8074-f952dce184d3.jpg	durenne-loris-N6AEawcTW_8-unsplash.jpg	jpg		2026-05-18 14:47:24.389378+00	1	10
19	/storage/1ed55988-dbf4-4916-94d7-bbe23afcacd3.jpg	fadi-al-shami-7w_UHC4pfRw-unsplash.jpg	jpg		2026-05-18 14:47:24.409555+00	1	10
20	/storage/10c62526-4556-44ab-bf70-4773c6ccebe6.mp4	8502797-uhd_2160_3840_24fps.mp4	mp4	Люди, стол на фоне гор	2026-05-18 14:50:07.968938+00	1	6
21	/storage/a31c6716-09d1-4a6f-a1ef-6b151515570c.jpg	huum-8xolqAd4u1U-unsplash.jpg	jpg		2026-05-18 14:50:08.008914+00	1	6
22	/storage/ea53e46f-735a-49a1-a622-343d25b57979.jpg	defier-nguyen-OEz_W6f1Zlc-unsplash.jpg	jpg		2026-05-18 14:50:08.022357+00	1	6
23	/storage/0fb688b5-5d8a-4ac3-bf9f-34b990af4355.jpg	alexander-mass-ajs6wW4NVjs-unsplash.jpg	jpg		2026-05-18 14:50:08.046015+00	1	6
24	/storage/0e1d4b31-9727-4e54-9e9b-10948efdb77a.jpg	stanley-kustamin-Dmnvt8atPYA-unsplash.jpg	jpg		2026-05-18 14:51:09.301918+00	1	1
25	/storage/c1250b50-f75a-4071-979a-4a72165fb20b.jpg	suzi-kim-brPjvrF20gE-unsplash.jpg	jpg		2026-05-18 14:51:09.318137+00	1	1
26	/storage/3da805ff-279c-4b4c-b342-8819372fd5e4.jpg	darya-jum-TMtLp0q2p-0-unsplash.jpg	jpg		2026-05-18 14:51:09.340762+00	1	1
27	/storage/e43f0bef-bd7a-4458-96a2-3c3ba134a0d4.jpg	marc-wieland-RAXD1BlJmSs-unsplash.jpg	jpg		2026-05-18 14:51:09.364441+00	1	1
31	/storage/e203b3c0-e244-42cc-9969-ee00a29a4e09.docx	brand history.docx	docx		2026-05-18 14:52:39.588766+00	1	9
30	/storage/4a24948a-48f5-4fe9-8417-7d163ea1b328.docx	ÐÑÑÐ¾ÑÐ¸Ñ Ð±ÑÐµÐ½Ð´Ð°.docx	docx		2026-05-18 14:52:13.500941+00	3	9
32	/storage/150f0d50-be6c-419e-980e-b92f5b534788.docx	eco tourism history.docx	docx		2026-05-18 14:53:03.857098+00	1	9
29	/storage/263f0c2d-eaa1-4be8-b39e-48cef6efb7e5.docx	ÐÑÑÐ¾ÑÐ¸Ñ ÑÐºÐ¾Ð»Ð¾Ð³Ð¸ÑÐ½Ð¾Ð³Ð¾ ÑÑÑÐ¸Ð·Ð¼Ð°.docx	docx		2026-05-18 14:52:13.488073+00	3	9
33	/storage/9ad75107-21d4-4164-b9c5-d8fd0970bc92.jpg	marc-wieland-RAXD1BlJmSs-unsplash.jpg	jpg		2026-05-18 14:54:20.747776+00	1	2
34	/storage/844447d5-5482-4bb2-8707-404558d7eea0.jpg	tommaso-ubezio-JSgaNP3QhGw-unsplash.jpg	jpg		2026-05-18 14:54:20.776421+00	1	2
35	/storage/b4a047ac-8ef8-4f55-a472-699b9cf6cf95.jpg	alef-morais-nq24NfTPU8c-unsplash.jpg	jpg		2026-05-18 14:56:01.623906+00	1	3
36	/storage/3f536ac3-46ec-43b0-b59d-1f2a6c248109.jpg	mudassir-zaheer-ehZ5cZZWrDg-unsplash.jpg	jpg		2026-05-18 14:56:21.334018+00	1	3
37	/storage/23d067f2-9478-439b-832d-f6c9275b368c.mp4	7663531-uhd_4096_2160_24fps.mp4	mp4		2026-05-18 14:57:52.83829+00	1	4
38	/storage/ba48ddbc-5b80-4d84-8ee2-5fdbd8ca29e3.mp4	14557126_1920_1080_25fps.mp4	mp4		2026-05-18 14:57:53.195485+00	1	4
39	/storage/fa2d4037-9b66-4a03-971f-5c1669eb5337.mp4	14462683_2160_3840_30fps.mp4	mp4		2026-05-18 14:57:53.542655+00	1	4
40	/storage/7d4e9fbc-62f1-42d7-b174-58658d348da7.mp4	14772984_2160_3840_60fps.mp4	mp4		2026-05-18 14:57:53.748437+00	1	4
41	/storage/71627a4f-6d24-4f03-ac4e-d6e37336dc54.jpg	olga-trishi-TeGVra59YLk-unsplash.jpg	jpg		2026-05-18 14:59:45.727596+00	1	5
42	/storage/29d17534-6b23-40f9-b32e-572e7fffd2f4.jpg	veriko-dundua-V7q-SPFek5Y-unsplash.jpg	jpg		2026-05-18 14:59:45.747327+00	1	5
43	/storage/23578991-a395-4d5b-8271-028cf75e9848.mp4	12518709_1440_2560_30fps.mp4	mp4		2026-05-18 14:59:46.498708+00	1	5
44	/storage/17f14de1-935b-404a-9f1f-b4f82d4757cf.jpg	amanda-llewelyn-jones-CL2c7sFXyoY-unsplash.jpg	jpg		2026-05-18 14:59:46.522994+00	1	5
45	/storage/74c4195e-f5aa-4bc8-a1b4-411740aee242.jpg	paul-pastourmatzis-ysA6qL8j-OI-unsplash.jpg	jpg		2026-05-18 14:59:46.537486+00	1	5
46	/storage/658c9456-0f84-4d9b-bdf7-158031d0c123.mp4	13322284_1080_1920_30fps.mp4	mp4		2026-05-18 14:59:46.576621+00	1	5
47	/storage/91338cb4-e3f7-45d7-b0e1-0138356cbd1e.mp4	13568900_3840_2160_60fps.mp4	mp4		2026-05-18 14:59:46.743325+00	1	5
48	/storage/5035bed6-e596-4032-9b35-bce5647e89ad.mp4	13777564_1080_1920_50fps.mp4	mp4		2026-05-18 14:59:46.898368+00	1	5
49	/storage/5fc4287d-80f6-4c4e-9eca-32da289f4164.mp4	2078088-uhd_3840_1634_25fps.mp4	mp4		2026-05-18 14:59:46.956667+00	1	5
50	/storage/1ce4f203-222c-47ba-a321-15e59590ff6a.jpg	alsu-vershinina-ZoE2xC2cDng-unsplash.jpg	jpg		2026-05-18 15:00:14.38789+00	1	5
51	/storage/423c5771-024e-4c93-8911-5eb5e4b92bf1.jpg	nickype-winter-3945779_1920.jpg	jpg		2026-05-18 15:01:58.726758+00	1	7
52	/storage/1f5ae6b7-5235-4c34-8d2f-8627fa675266.png	vilkasss-autumn-8187484_1920.png	png		2026-05-18 15:01:58.771804+00	1	7
53	/storage/c6992789-69eb-46c9-9a6b-321c44d1f714.jpg	ua_bob_dmyt_ua-kids-3448161_1920.jpg	jpg		2026-05-18 15:01:58.784115+00	1	7
54	/storage/7be66896-ae0b-448f-bbf4-a6536b0a4625.docx	sale summer.docx	docx		2026-05-18 15:02:55.021172+00	1	8
55	/storage/85ba368c-ab1a-4119-a161-a8049d97f19c.docx	sale new year 2027.docx	docx	скидки на продажи на новый год 2027	2026-05-18 15:02:55.033322+00	1	8
56	/storage/2cd37462-9dbf-4bd9-bfe9-e34ca340ed27.jpg	pexels-kuva-26502094.jpg	jpg		2026-05-18 15:03:50.007983+00	1	5
57	/storage/15be340b-8dd0-4028-9850-3fb5f3ad2b23.jpg	pexels-michael-burrows-7125471.jpg	jpg		2026-05-18 15:05:06.07928+00	1	14
58	/storage/28144662-67a8-4cb9-8ccc-a12a486afc42.jpg	kevin-canlas-WbdkFHDFbTg-unsplash.jpg	jpg		2026-05-18 15:05:06.093942+00	1	14
59	/storage/dadfe8df-c5d0-475d-a54a-d15254b3b0ce.jpg	mohamed-shaffaf-RZJRWMnd0DM-unsplash.jpg	jpg		2026-05-18 15:05:06.139716+00	1	14
60	/storage/b4d3d23f-a2a8-4f7b-ad93-3dac34a40fa9.jpg	christina-rumpf-LMzwJDu6hTE-unsplash.jpg	jpg		2026-05-18 15:05:06.160005+00	1	14
61	/storage/d1d51a29-8bbd-4f83-9ca1-32f174cb32a3.jpg	nathan-dumlao-tA90pRfL2gM-unsplash.jpg	jpg		2026-05-18 15:05:52.969592+00	1	15
62	/storage/8125efe4-ec77-4026-bb5e-fdb9b9e684e7.jpg	tabitha-turner-PSqT-lQAt7A-unsplash.jpg	jpg		2026-05-18 15:05:53.038494+00	1	15
63	/storage/b2003834-dcb8-49e8-8cc4-da82722f19c7.jpg	nathan-dumlao-zUNs99PGDg0-unsplash.jpg	jpg		2026-05-18 15:05:53.068835+00	1	15
64	/storage/6926ffa7-d55d-4b03-8608-d981004a78a8.jpg	michael-c-A3K6lKG4yKY-unsplash.jpg	jpg		2026-05-18 15:06:26.142403+00	1	16
65	/storage/a8154176-e896-453d-80df-6003a1e13168.jpg	nuttawut-anek-vgNU1ujE8Mk-unsplash.jpg	jpg		2026-05-18 15:06:26.186592+00	1	16
66	/storage/01022c36-9c42-4cca-a535-ab7a9441daf1.jpg	alexander-jawfox-F-6v14W67Ak-unsplash.jpg	jpg		2026-05-18 15:06:26.215069+00	1	16
67	/storage/c7d538bf-d4d5-4378-8b22-12bb59f4de64.docx	interactive.docx	docx	текст для интерактива	2026-05-18 15:07:36.091812+00	1	17
68	/storage/5e96a7d1-782a-497e-affc-4d800f59f133.jpg	pexels-omeraydin-10865353.jpg	jpg		2026-05-18 15:07:36.108974+00	1	17
69	/storage/cc6e5bc5-f9ec-4e68-8f28-c7f971e12811.jpg	pexels-silverkblack-36765282.jpg	jpg		2026-05-18 15:07:36.122314+00	1	17
70	/storage/71f70373-e80b-447e-9039-4b64940ea6e6.jpg	pexels-anna-morgan-75707674-17238517.jpg	jpg		2026-05-18 15:07:36.135042+00	1	17
71	/storage/0088f001-4ef3-4c98-b19f-415a4ebbe31f.docx	special coffee sale.docx	docx	Скидки на специальное меню	2026-05-18 15:08:51.338193+00	1	18
72	/storage/b5c291f1-6ad3-4cb4-92eb-e438999043ce.jpg	nhn-hR_42Z6mZLk-unsplash.jpg	jpg		2026-05-18 15:08:51.982181+00	1	18
73	/storage/88be6cc3-4c02-4417-bf8f-17276e7967e4.jpg	spoton-5toawRCmULM-unsplash.jpg	jpg		2026-05-18 15:08:52.043344+00	1	18
74	/storage/5239fe26-632b-48c6-b4a8-e80264785bc9.jpg	nicholas-ng-Ni4bIxXuKcc-unsplash.jpg	jpg		2026-05-18 15:08:52.692161+00	1	18
28	/storage/75c471fe-9a6f-4ad6-91d0-4d4d932b9841.jpg	sara-dubler-Koei_7yYtIo-unsplash.jpg	jpg	Место отдыха	2026-05-18 14:51:09.37799+00	1	1
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, goal, start_date, end_date, status_id) FROM stdin;
1	Продвижение эко-отеля «Зелёный Берег»	Увеличение числа бронирований и повышение узнаваемости бренда (~1000 реакций на постах)	2026-05-24	2026-09-26	1
2	SMM для кофейни «Coffee House»	Привлечение посетителей и повышение продаж сезонных напитков в 1.5 раза	2026-05-01	2026-06-15	2
3	Продвижение туристического блога «Travel Horizons»	Рост аудитории и вовлечённости на площадках социальных сетей	2026-05-01	2026-05-16	4
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description) FROM stdin;
1	Админ	подтверждение учётных записей, администрирование
2	Менеджер	создание проектов, назначение исполнителей, клиентов
3	Исполнитель	работа в определенных проектах
4	Внешний подрядчик	исключительно загрузка
5	Клиент	просмотр определенных проектов, комментирование
\.


--
-- Data for Name: statuses_media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statuses_media (id, name) FROM stdin;
1	Активный
2	Удалённый
3	Архивный
\.


--
-- Data for Name: statuses_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statuses_projects (id, name) FROM stdin;
1	Запланированный
2	Активный
3	Приостановленный
4	Завершенный
\.


--
-- Data for Name: statuses_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statuses_tasks (id, name) FROM stdin;
1	К выполнению
2	В работе
3	На проверке
4	Выполнено
5	Отменено
\.


--
-- Data for Name: statuses_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statuses_users (id, name) FROM stdin;
1	На подтверждении
2	Активный
3	Отключён
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, name, description, deadline, role_id, project_id, status_id) FROM stdin;
1	Фотосессия территории и номеров	Подготовить и загрузить фотографии территории отеля, интерьеров номеров, зон отдыха и окружающей природы для использования в публикациях и рекламных материалах	2026-05-27 09:00:00+00	3	1	2
2	Создание серии коротких видеороликов (Reels)	Смонтировать короткие вертикальные видеоролики с природными видами, прогулочными маршрутами и атмосферой отдыха в отеле	2026-05-28 04:30:00+00	4	1	1
3	Подготовка текстов для публикаций	Разработать тексты для десяти постов, посвящённых преимуществам отдыха, экологической концепции и сезонным предложениям отеля	2026-05-29 05:00:00+00	3	1	3
4	Монтаж видеоролика «10 дней у моря»	Смонтировать динамичный видеоролик из дрон-съёмки, кадров заката и дорожных сцен для публикации	2026-05-05 18:20:00+00	4	3	4
7	Съёмка процесса приготовления напитков	Подготовить фото- и видеоматериалы с процессом приготовления кофе, подачей напитков и атмосферой заведения	2026-05-07 01:20:00+00	4	2	4
8	Разработка публикаций в социальных сетях	Разработать тексты для 20 постов, посвящённых преимуществам кофе, книг, животных. Найти картинки для ловли внимания	2026-05-15 08:00:00+00	3	2	4
9	Подготовка контент-плана для Stories	Составить план публикаций на месяц с интерактивными опросами, акциями и анонсами новинок	2026-05-20 10:10:00+00	3	2	3
5	Разработка обложек для видео	Создать набор привлекательных миниатюр для видеороликов блога с единым фирменным стилем	2026-05-14 11:20:00+00	3	3	5
6	Подбор и обработка фотографий природы	Отобрать лучшие фотографии побережья, гор, лесных дорог и закатов, выполнить базовую цветокоррекцию и подготовить их к публикации	2026-05-14 15:20:00+00	3	3	4
\.


--
-- Data for Name: user_project; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_project (id, user_id, project_id, included_at, excluded_at) FROM stdin;
1	2	1	2026-05-18 12:39:45.192135+00	\N
2	7	1	2026-05-18 12:39:45.192135+00	\N
3	6	1	2026-05-18 12:39:45.192135+00	\N
4	5	1	2026-05-18 12:39:45.192135+00	\N
5	2	2	2026-05-18 13:40:21.728103+00	\N
6	9	2	2026-05-18 13:40:21.728103+00	\N
7	6	2	2026-05-18 13:40:21.728103+00	\N
8	8	2	2026-05-18 13:40:21.728103+00	\N
9	2	3	2026-05-18 13:41:33.861913+00	\N
10	7	3	2026-05-18 13:41:33.861913+00	\N
11	10	3	2026-05-18 13:41:33.861913+00	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, registered_at, status_id, role_id) FROM stdin;
1	Администратор	admin@admin.com	$2b$10$.zr77HKjrQw8Q9ITrQJ93.M1jDZACGtwLYVLEESVh6TxR7Y9LOzmS	2026-05-18 11:57:51.448141+00	2	1
2	Анна	anna@ya.ru	$2b$10$p3h3PEFDo6X1XR/oxj/KCO5tkOLR38dx1YUZcTfZOjXZV3XguydgK	2026-05-18 12:18:00.802202+00	2	2
6	Лиллия	lilith@li.hk	$2b$10$anhxxzxSfae2cfx8funtGu/EXQyBu5E3OrweSpd25vZGtnUySPzRe	2026-05-18 12:25:39.622354+00	2	3
5	Зелёный Берег	green.coast@gc.com	$2b$10$ehpFNiokQT4XIAtI/qFweegpYpkX7KnzsOF8ZoWjdx3rGZ1dt6lAe	2026-05-18 12:23:20.399176+00	2	5
8	Coffee House	coffehouse@ch.ch	$2b$10$.0.o1ZuXoyrEPgeDuPk2M.v31caXdw32I6Y657Fn9dTONqzWZpL7m	2026-05-18 12:31:32.919244+00	2	5
7	Andrey	andrey@sokolov.ru	$2b$10$J/FMJpvenaZnlLP5MeMwX.viFnBE9J6MT0RLNGgYRXjIao.ZrPUzG	2026-05-18 12:30:11.490576+00	2	4
9	Аксель	axle@ax.us	$2b$10$ycbTeeLZgple8yLlI7Ff0u.DqoixwDifTGuhWcpyx.magJUIudZC.	2026-05-18 12:34:08.464648+00	2	3
11	Сергей	ser.gamer@gmail.com	$2b$10$nNglKC7PZAjb2SzDD8Hqu.iQjpCZQNc3IrUmn1KY8sutfYKhopUCi	2026-05-18 16:02:21.44544+00	1	3
10	Диана	diana@protonmail.com	$2b$10$P8sj3zZVCwBv3KqvhoqeWuTlZlB05/S8Mi/33ATMFNhXG1kSnbBf6	2026-05-18 12:35:04.130785+00	3	3
\.


--
-- Name: collections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.collections_id_seq', 19, true);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 2, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.media_id_seq', 74, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- Name: statuses_media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.statuses_media_id_seq', 3, true);


--
-- Name: statuses_projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.statuses_projects_id_seq', 4, true);


--
-- Name: statuses_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.statuses_tasks_id_seq', 5, true);


--
-- Name: statuses_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.statuses_users_id_seq', 3, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 9, true);


--
-- Name: user_project_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_project_id_seq', 11, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 11, true);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: statuses_media statuses_media_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_media
    ADD CONSTRAINT statuses_media_name_key UNIQUE (name);


--
-- Name: statuses_media statuses_media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_media
    ADD CONSTRAINT statuses_media_pkey PRIMARY KEY (id);


--
-- Name: statuses_projects statuses_projects_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_projects
    ADD CONSTRAINT statuses_projects_name_key UNIQUE (name);


--
-- Name: statuses_projects statuses_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_projects
    ADD CONSTRAINT statuses_projects_pkey PRIMARY KEY (id);


--
-- Name: statuses_tasks statuses_tasks_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_tasks
    ADD CONSTRAINT statuses_tasks_name_key UNIQUE (name);


--
-- Name: statuses_tasks statuses_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_tasks
    ADD CONSTRAINT statuses_tasks_pkey PRIMARY KEY (id);


--
-- Name: statuses_users statuses_users_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_users
    ADD CONSTRAINT statuses_users_name_key UNIQUE (name);


--
-- Name: statuses_users statuses_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses_users
    ADD CONSTRAINT statuses_users_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_project user_project_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_project
    ADD CONSTRAINT user_project_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_collections_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_task_id ON public.collections USING btree (task_id);


--
-- Name: idx_comments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_created_at ON public.comments USING btree (created_at);


--
-- Name: idx_comments_media_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_media_id ON public.comments USING btree (media_id);


--
-- Name: idx_comments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_user_id ON public.comments USING btree (user_id);


--
-- Name: idx_media_collection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_collection_id ON public.media USING btree (collection_id);


--
-- Name: idx_media_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_status_id ON public.media USING btree (status_id);


--
-- Name: idx_projects_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_status_id ON public.projects USING btree (status_id);


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);


--
-- Name: idx_tasks_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_role_id ON public.tasks USING btree (role_id);


--
-- Name: idx_tasks_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status_id ON public.tasks USING btree (status_id);


--
-- Name: idx_user_project_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_project_project_id ON public.user_project USING btree (project_id);


--
-- Name: idx_user_project_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_project_user_id ON public.user_project USING btree (user_id);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: idx_users_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status_id ON public.users USING btree (status_id);


--
-- Name: collections collections_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: comments comments_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id);


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: media media_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id);


--
-- Name: media media_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses_media(id);


--
-- Name: projects projects_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses_projects(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: tasks tasks_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: tasks tasks_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses_tasks(id);


--
-- Name: user_project user_project_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_project
    ADD CONSTRAINT user_project_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: user_project user_project_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_project
    ADD CONSTRAINT user_project_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: users users_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses_users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Cxu9tE7jSEh54hkOGqD0LVWG87WXzfxir6uLxsZszLxZBQNu59AFVGs6DdLmQ4n

