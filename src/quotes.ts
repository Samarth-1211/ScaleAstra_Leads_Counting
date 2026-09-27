export type Quote = { text: string; author?: string };

export const QUOTES: Quote[] = [
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: "You miss 100% of the shots you don't take.", author: 'Wayne Gretzky' },
  { text: "It's not whether you get knocked down, it's whether you get up.", author: 'Vince Lombardi' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: "Opportunities don't happen. You create them.", author: 'Chris Grosser' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: "Hard work beats talent when talent doesn't work hard.", author: 'Tim Notke' },
  { text: 'Great things are done by a series of small things brought together.', author: 'Vincent van Gogh' },
  { text: "Dreams don't work unless you do.", author: 'John C. Maxwell' },
  { text: 'Your attitude, not your aptitude, will determine your altitude.', author: 'Zig Ziglar' },
  {
    text: 'Approach each customer with the idea of helping him or her to solve a problem or achieve a goal, not of selling a product or service.',
    author: 'Brian Tracy',
  },
  { text: 'Pressure is a privilege.', author: 'Billie Jean King' },
  { text: 'I never dreamed about success. I worked for it.', author: 'Estée Lauder' },
  { text: 'The only place where success comes before work is in the dictionary.', author: 'Vidal Sassoon' },
  { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
  { text: "You don't close a sale; you open a relationship.", author: 'Patricia Fripp' },
  { text: "Excellence is not a skill. It's an attitude.", author: 'Ralph Marston' },
  { text: 'Arise, awake, and stop not till the goal is reached.', author: 'Swami Vivekananda' },
  { text: 'Excellence is a continuous process and not an accident.', author: 'A. P. J. Abdul Kalam' },
  { text: 'If you want to shine like a sun, first burn like a sun.', author: 'A. P. J. Abdul Kalam' },
  { text: 'The difference between ordinary and extraordinary is that little extra.', author: 'Jimmy Johnson' },
  { text: 'Every no gets you one call closer to a yes.' },
];

export const randomQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];
