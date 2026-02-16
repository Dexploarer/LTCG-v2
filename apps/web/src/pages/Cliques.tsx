import { useState } from "react";
import { useNavigate } from "react-router";
import { usePrivy } from "@privy-io/react-auth";
import { TrayNav } from "@/components/layout/TrayNav";
import { useConvexQuery, useConvexMutation, apiAny } from "@/lib/convexHelpers";
import { LANDING_BG } from "@/lib/blobUrls";
import { getArchetypeTheme } from "@/lib/archetypeThemes";

interface Clique {
  _id: string;
  name: string;
  archetype: string;
  description: string;
  memberCount: number;
  totalWins: number;
}

const CLIQUE_NAMES: Record<string, string> = {
  dropouts: "Dropout Gang",
  preps: "Honor Club",
  geeks: "Geek Squad",
  freaks: "Freak Show",
  nerds: "Nerd Herd",
  goodies: "Goodie Two-Shoes",
};

export function Cliques() {
  const navigate = useNavigate();
  const { authenticated } = usePrivy();
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cliques = useConvexQuery(apiAny.cliques.getAllCliques, authenticated ? {} : "skip") as Clique[] | undefined;
  const myClique = useConvexQuery(apiAny.cliques.getMyClique, authenticated ? {} : "skip") as Clique | null | undefined;
  
  const joinMutation = useConvexMutation(apiAny.cliques.joinClique);
  const leaveMutation = useConvexMutation(apiAny.cliques.leaveClique);

  const handleJoin = async (cliqueId: string, archetype: string) => {
    setJoining(cliqueId);
    setError(null);
    try {
      await joinMutation({ cliqueId });
      setSuccess(`Welcome to ${CLIQUE_NAMES[archetype] || archetype}!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    }
    setJoining(null);
  };

  const handleLeave = async () => {
    if (!confirm("Leave this clique?")) return;
    setError(null);
    try {
      await leaveMutation({});
      setSuccess("You left the clique");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave");
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('${LANDING_BG}')` }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 p-4 md:p-8 pb-24 max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)] mb-2"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Cliques
          </h1>
          <p
            className="text-[#ffcc00] text-base md:text-lg"
            style={{ fontFamily: "Special Elite, cursive" }}
          >
            Find your crew. Rule the school.
          </p>
        </header>

        {error && (
          <div className="bg-red-600 text-white px-4 py-2 mb-4 font-bold uppercase text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-600 text-white px-4 py-2 mb-4 font-bold uppercase text-sm">
            {success}
          </div>
        )}

        {myClique && (
          <div className="paper-panel p-6 mb-8">
            <h2 className="text-xl font-black uppercase mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              Your Clique
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold" style={{ 
                  color: getArchetypeTheme(myClique.archetype).color
                }}>
                  {myClique.name}
                </h3>
                <p className="text-sm text-gray-600">{myClique.memberCount} members</p>
              </div>
              <button
                onClick={handleLeave}
                className="tcg-button text-sm"
              >
                Leave
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cliques?.map((clique) => {
            const theme = getArchetypeTheme(clique.archetype);
            const isMyClique = myClique?._id === clique._id;
            
            return (
              <div
                key={clique._id}
                className="paper-panel p-6 relative overflow-hidden"
              >
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${theme.color} 0%, transparent 100%)`
                  }}
                />
                
                <div className="relative">
                  <h3 
                    className="text-2xl font-black uppercase mb-1"
                    style={{ 
                      color: theme.color,
                      fontFamily: "Outfit, sans-serif"
                    }}
                  >
                    {clique.name}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: "Special Elite, cursive" }}>
                    {clique.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">
                      <span className="text-gray-500">Members:</span>{" "}
                      <span className="text-[#121212]">{clique.memberCount}</span>
                    </div>
                    
                    {isMyClique ? (
                      <span className="tcg-button-primary px-4 py-1 text-sm">
                        Joined
                      </span>
                    ) : myClique ? (
                      <span className="tcg-button px-4 py-1 text-sm opacity-50 cursor-not-allowed">
                        Already in Clique
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoin(clique._id, clique.archetype)}
                        disabled={joining === clique._id}
                        className="tcg-button-primary px-4 py-1 text-sm"
                      >
                        {joining === clique._id ? "Joining..." : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!authenticated && (
          <div className="text-center mt-8">
            <button
              onClick={() => navigate("/")}
              className="tcg-button"
            >
              Sign In to Join a Clique
            </button>
          </div>
        )}
      </div>

      <TrayNav />
    </div>
  );
}

export default Cliques;
