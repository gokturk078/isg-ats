import { redirect } from 'next/navigation';

export default function TaskEditPage() {
    // Editor sayfası — görev detay sayfasından yönlendirme ile erişilir
    // Bu sayfa ileride tam düzenleme formu olarak genişletilecek
    redirect('/tasks');
}
