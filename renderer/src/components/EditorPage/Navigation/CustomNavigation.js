/* eslint-disable react/prop-types */
import PropTypes from 'prop-types';
import { Dialog, Transition } from '@headlessui/react';
import {
  Fragment, useEffect, useRef, useState,
} from 'react';
import SelectBook from '@/components/EditorPage/Navigation/reference/SelectBook';
import SelectVerse from '@/components/EditorPage/Navigation/reference/SelectVerse';
import {
  XIcon,
  ChevronDownIcon,
} from '@heroicons/react/solid';
import { useBibleReference } from 'bible-reference-rcl';

export default function CustomNavigation({
  initialBook,
  initialChapter,
  initialVerse,
  setNavigation,
  showVerse,
}) {
  const {
    state: {
      bookId,
      bookList,
      bookName,
      chapter,
      verse,
      chapterList,
      verseList,
    }, actions: {
      onChangeBook,
      onChangeChapter,
      onChangeVerse,
      applyBooksFilter,
    },
  } = useBibleReference({
    initialBook,
    initialChapter,
    initialVerse,
});
  const [openBook, setOpenBook] = useState(false);
  const [openVerse, setOpenVerse] = useState(false);
  const cancelButtonRef = useRef(null);
  const supportedBooks = null;

  const [multiSelectVerse] = useState(false);
  const [multiSelectBook] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [verselectActive, setVerseSelectActive] = useState(false);

  useEffect(() => {
    applyBooksFilter(supportedBooks);
  }, [applyBooksFilter, supportedBooks]);

  useEffect(() => {
    setNavigation({
      bookId, chapter, verse,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapter, verse]);

  function closeBooks() {
    setOpenBook(false);
  }

  function openBooks() {
    setOpenBook(true);
  }

  function closeVerses() {
    setOpenVerse(false);
    if (multiSelectVerse) { setVerseSelectActive(true); }
  }

  function selectBook() {
    setOpenBook(false);
    setOpenVerse(true);
    if (multiSelectVerse) { setSelectedVerses([]); }
  }

//   useEffect(() => {
//     if (isElectron()) {
//       localforage.getItem('refBibleBurrito')
//         .then((refs) => {
//           refs.forEach((ref) => {
//             if (languageId !== null) {
//             if (ref.languages[0].tag === languageId) {
//               const supportedBooks = [];
//               Object.entries((ref.type.flavorType.currentScope)).forEach(
//                   ([key]) => {
//                     supportedBooks.push(key.toLowerCase());
//                   },
//                   );
//                   applyBooksFilter(supportedBooks);
//                 }
//               }
//           });
//       });
//   }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [languageId]);

  return (
    <>
      <div className="flex">
        <div className="bg-primary text-white py-2 uppercase tracking-wider text-sm font-semibold">
          <span className="px-3">{bookName}</span>
          <span
            className="focus:outline-none bg-white py-4 bg-opacity-10"
            onClick={openBooks}
            role="button"
            tabIndex="-2"
          >
            <ChevronDownIcon className="focus:outline-none inline h-4 w-4 mx-1 text-white" aria-hidden="true" />
          </span>
          <span className="px-3">{chapter}</span>
          <span
            className="focus:outline-none bg-white py-4 bg-opacity-10"
            onClick={selectBook}
            role="button"
            tabIndex="-1"
          >
            <ChevronDownIcon className="focus:outline-none inline h-4 w-4 mx-1 text-white" aria-hidden="true" />
          </span>
          {showVerse
            && (
              <span className="px-3">
                {multiSelectVerse
                  ? selectedVerses.join()
                  : verse}
              </span>
            )}
        </div>
      </div>
      <Transition
        show={openBook}
        as={Fragment}
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          initialFocus={cancelButtonRef}
          static
          open={openBook}
          onClose={closeBooks}
        >
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <div className="flex items-center justify-center h-screen ">
            <div className="w-5/12 m-auto z-50 shadow overflow-hidden sm:rounded-lg">
              <SelectBook
                selectBook={selectBook}
                bookList={bookList}
                onChangeBook={onChangeBook}
                multiSelectBook={multiSelectBook}
                selectedBooks={selectedBooks}
                setSelectedBooks={setSelectedBooks}
              >
                <button
                  type="button"
                  className="focus:outline-none w-9 h-9 bg-black p-2"
                  onClick={closeBooks}
                >
                  <XIcon />
                </button>
              </SelectBook>
            </div>
          </div>

        </Dialog>
      </Transition>

      <Transition
        show={openVerse}
        as={Fragment}
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          initialFocus={cancelButtonRef}
          static
          open={openVerse}
          onClose={closeVerses}
        >

          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <div className="flex items-center justify-center h-screen">

            <div className="w-3/12 m-auto z-50 bg-black text-white shadow overflow-hidden sm:rounded-lg">
              <SelectVerse
                chapter={chapter}
                verse={verse}
                chapterList={chapterList}
                verseList={verseList}
                bookName={bookName}
                onChangeChapter={onChangeChapter}
                onChangeVerse={onChangeVerse}
                closeBooks={closeBooks}
                closeVerses={closeVerses}
                multiSelectVerse={multiSelectVerse}
                selectedVerses={selectedVerses}
                setSelectedVerses={setSelectedVerses}
                verselectActive={verselectActive}
                setVerseSelectActive={setVerseSelectActive}
              >
                <button
                  type="button"
                  className="focus:outline-none w-9 h-9 bg-black p-2"
                  onClick={closeVerses}
                >
                  <XIcon />
                </button>
              </SelectVerse>
            </div>
          </div>

        </Dialog>
      </Transition>
    </>
  );
}

CustomNavigation.propTypes = {
  showVerse: PropTypes.bool,
};
