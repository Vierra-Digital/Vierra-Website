import React, { useState, useRef, MouseEvent, useEffect } from "react"
import { Bricolage_Grotesque as BricolageGrotesqueFont, Inter as InterFont } from "next/font/google"
import Image from "next/image"
import { X } from "lucide-react"
import fetchStaff from "@/pages/api/fetchStaff"

const Bricolage_Grotesque = BricolageGrotesqueFont({ subsets: ["latin"] });
const inter = InterFont({ subsets: ["latin"] });

interface StaffOrbitalModalProps {
    isOpen: boolean
    onClose: () => void
}

interface User {
    id: string;
    name: string;
    position: string;
    country: string;
    timeZone: string;
    mentor: string;
    email: string;
    companyEmail: string;
    strikes: "N/A" | 0 | 1 | 2 | 3;
}

// test data for formatting
const testData: User[] = [
    {
        id: "1",
        name: "Alex S.",
        position: "CEO & Founder",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "None",
        email: "business@alexshick.com",
        companyEmail: "alex.shick@vierradev.com",
        strikes: "N/A",
    },
    {
        id: "2",
        name: "Paul W.",
        position: "Chief Operations Officer",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "pwahba22@gmail.com",
        companyEmail: "paul.wahba@vierradev.com",
        strikes: "N/A",
    },
    {
        id: "3",
        name: "Abin J.",
        position: "Chief Marketing Officer",
        country: "United Kingdom",
        timeZone: "Greenwich Mean (GMT)",
        mentor: "Paul",
        email: "ajteekoy@gmail.com",
        companyEmail: "abin.jteekoy@vierradev.com",
        strikes: "N/A",
    },
    {
        id: "4",
        name: "Vil J.",
        position: "Chief Technology Officer",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "vilhjalmur1230@gmail.com",
        companyEmail: "vilhjalmur.johnson@vierradev.com",
        strikes: 0,
    },
    {
        id: "5",
        name: "Josh H.",
        position: "Backend Developer",
        country: "Jamaica",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "hello@joshuaharris.net",
        companyEmail: "joshua.harris@vierradev.com",
        strikes: 0,
    },
    {
        id: "6",
        name: "Ej A.",
        position: "Frontend Developer",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "agojo.eljohn@gmail.com",
        companyEmail: "eljohn.agojo@vierradev.com",
        strikes: 0,
    },
    {
        id: "7",
        name: "Jeremy C.",
        position: "Frontend Developer",
        country: "United States",
        timeZone: "Mountain Standard (MST)",
        mentor: "Alex",
        email: "cardenas.jermyy@gmail.com",
        companyEmail: "jeremy.cardenas@vierradev.com",
        strikes: 0,
    },
    {
        id: "8",
        name: "John A.",
        position: "Frontend Developer",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "agojo62@gmail.com",
        companyEmail: "john.agojo@vierradev.com",
        strikes: 0,
    },
    {
        id: "9",
        name: "Thomas W.",
        position: "Frontend Developer",
        country: "United States",
        timeZone: "Eastern Standard (EST)",
        mentor: "Alex",
        email: "thomasmwalsh217@gmail.com",
        companyEmail: "thomas.walsh@vierradev.com",
        strikes: 0,
    },
    {
        id: "10",
        name: "Hunter O.",
        position: "UI/UX Designer",
        country: "Nigeria",
        timeZone: "Greenwich Mean (GMT+1)",
        mentor: "Alex",
        email: "hunterefe1@gmail.com",
        companyEmail: "hunter.opeyemi@vierradev.com",
        strikes: 0,
    },
    {
        id: "11",
        name: "Emmanuel M.",
        position: "UI/UX Designer",
        country: "Nigeria",
        timeZone: "Greenwich Mean (GMT+1)",
        mentor: "Alex",
        email: "emmanuelmarvelous049@gmail.com",
        companyEmail: "emmanuel.marvelous@vierradev.com",
        strikes: 0,
    },
];

const StaffOrbitalModal: React.FC<StaffOrbitalModalProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<User[]>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getUsers = async () => {
            try {
                const res = await fetch('/api/fetchStaff?table=users');
                const data = await res.json();
                setUsers(data);
            } catch (err) {
                console.error('Fetch failed:', err);
            } finally {
                setLoading(false);
            }
        };

        getUsers();
    }, []);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
            onClick={handleOutsideClick}
        >
            <div ref={modalRef} className={`relative bg-[#18042A]/90 border border-[#701CC0]/50 backdrop-blur-md rounded-lg p-6 max-h-[90vh] shadow-lg text-white flex flex-col overflow-hidden ${inter.className}`}>
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors z-10"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={24} />
                </button>
                <div className="flex justify-center mb-4 pt-2">
                    <Image
                        src="/assets/vierra-logo.png"
                        alt="Vierra Logo"
                        width={120}
                        height={40}
                        className="w-auto h-10"
                    />
                </div>
                <h2 className={`text-2xl font-bold mb-5 text-center ${Bricolage_Grotesque.className}`}>
                    Staff Orbital
                </h2>
                <div id="sheet-window" className="flex-grow overflow-y-auto px-2 pb-4">
                    {/* {loading && <p>Loading...</p>}

                    {!loading && users && (
                        <ul>
                            {users.map((user: any, index: number) => (
                                <li key={index}>
                                    {user.column_name} - {user.data_type}
                                </li>
                            ))}
                        </ul>
                    )} */}
                    <div id="outside-of-table" className="border border-[#701CC0]/50 rounded-lg">
                        <table>
                            <thead className="text-xs border-2 border-[#701CC0]/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">
                                        Name
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Position
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Country
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Timezone
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Mentor
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Email
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Company Email
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Strikes
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {testData.map((user: User) => (
                                    <tr className="text-sm border-b border-[#701CC0]/50">
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.name}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.position}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.country}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.timeZone}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.mentor}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-3 border-r border-[#701CC0]/50">
                                            {user.companyEmail}
                                        </td>
                                        <td className="px-6 py-3">
                                            {user.strikes}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    )
}
export default StaffOrbitalModal;